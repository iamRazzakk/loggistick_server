import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import ApiError from "../../../../errors/ApiErrors";
import { errorLogger } from "../../../../shared/logger";
import { User } from "../../user/user.model";
import { Booking } from "../../booking/booking.model";
import {
  DRIVER_DUTY_KEY,
  DRIVER_LOC_KEY,
  DRIVER_PERSIST_EVERY_SEC,
  IDriverLiveLocation,
  IDriverLocationPayload,
  ILiveTracking,
  IToggleDutyPayload,
} from "./driverDuty.interface";
import {
  isFreshLocation,
  parseLiveLocation,
  readDutyFromMongo,
  redisGet,
  removeLiveFromRedis,
  saveLastKnownLocation,
  writeLiveToRedis,
} from "./driverDuty.store";

const lastMongoPersistAt = new Map<string, number>();

type ITrackingTarget = { bookingId: string; userId: string };

const LIVE_STATUSES = ["assigned", "in-progress", "confirmed"];

const asObjectId = (id: string) =>
  Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;

const toLiveLocation = (
  payload: IDriverLocationPayload,
): IDriverLiveLocation => ({
  lat: payload.lat,
  lng: payload.lng,
  heading: payload.heading ?? null,
  speed: payload.speed ?? null,
  updatedAt: Date.now(),
  bookingId: payload.bookingId,
});

const persistDutyFlag = async (driverId: string, isOnDuty: boolean) => {
  try {
    await User.findByIdAndUpdate(driverId, { isOnDuty });
    return true;
  } catch (error) {
    errorLogger.error(`Mongo duty update failed for ${driverId}: ${error}`);
    return false;
  }
};

const isDriverOnDuty = async (driverId: string) => {
  const redisDuty = await redisGet(DRIVER_DUTY_KEY(driverId));
  if (redisDuty.ok && redisDuty.value === "1") return true;
  if (redisDuty.ok && redisDuty.value === "0") return false;

  const driver = await readDutyFromMongo(driverId);
  return driver?.isOnDuty === true;
};

const getDriverTrackingTargets = async (driverId: string) => {
  const bookings = await Booking.find({
    driverId: asObjectId(driverId),
    bookingStatus: { $in: LIVE_STATUSES },
  })
    .select("_id userId")
    .lean();

  return bookings.map((booking) => ({
    bookingId: String(booking._id),
    userId: String(booking.userId),
  })) as ITrackingTarget[];
};

const getTrackingBookingsForUser = async (userId: string) => {
  return Booking.find({
    $or: [{ userId: asObjectId(userId) }, { driverId: asObjectId(userId) }],
    bookingStatus: { $in: LIVE_STATUSES },
  })
    .select("_id userId driverId")
    .lean();
};

const toggleDuty = async (user: JwtPayload, payload: IToggleDutyPayload) => {
  const { isOnDuty } = payload;

  if (isOnDuty) {
    const live = toLiveLocation({
      lat: payload.lat as number,
      lng: payload.lng as number,
      heading: payload.heading,
      speed: payload.speed,
    });

    const redisOk = await writeLiveToRedis(user.id, live);
    await saveLastKnownLocation(user.id, live, true);
    const targets = await getDriverTrackingTargets(user.id);

    return {
      isOnDuty: true,
      isLive: redisOk,
      isFallback: !redisOk,
      location: live,
      targets,
    };
  }

  const redisOk = await removeLiveFromRedis(user.id);
  await persistDutyFlag(user.id, false);
  const targets = await getDriverTrackingTargets(user.id);

  return {
    isOnDuty: false,
    isLive: redisOk,
    isFallback: !redisOk,
    location: null,
    targets,
  };
};

const updateLocation = async (
  user: JwtPayload,
  payload: IDriverLocationPayload,
) => {
  const onDuty = await isDriverOnDuty(user.id);
  if (!onDuty) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Turn on duty before sending location",
    );
  }

  const live = toLiveLocation(payload);
  const redisOk = await writeLiveToRedis(user.id, live);

  const now = Date.now();
  const last = lastMongoPersistAt.get(user.id) || 0;
  if (now - last >= DRIVER_PERSIST_EVERY_SEC * 1000) {
    lastMongoPersistAt.set(user.id, now);
    await saveLastKnownLocation(user.id, live);
  }

  const targets = await getDriverTrackingTargets(user.id);

  return {
    ok: true,
    isLive: redisOk,
    isFallback: !redisOk,
    location: live,
    targets,
  };
};

export const readDriverLiveTracking = async (
  driverId: string,
): Promise<ILiveTracking> => {
  const [redisDuty, redisRaw] = await Promise.all([
    redisGet(DRIVER_DUTY_KEY(driverId)),
    redisGet(DRIVER_LOC_KEY(driverId)),
  ]);

  const isRedisAvailable = redisDuty.ok && redisRaw.ok;
  const redisLocation = parseLiveLocation(redisRaw.value);
  const redisOnDuty = isRedisAvailable && redisDuty.value === "1";
  const redisFresh = redisOnDuty && isFreshLocation(redisLocation?.updatedAt);

  if (redisFresh && redisLocation) {
    return {
      isOnDuty: true,
      isStale: false,
      isFallback: false,
      isRedisAvailable: true,
      location: redisLocation,
    };
  }

  const driver = await readDutyFromMongo(driverId);
  const isOnDuty = redisOnDuty || driver?.isOnDuty === true;

  if (!isOnDuty) {
    return {
      isOnDuty: false,
      isStale: true,
      isFallback: false,
      isRedisAvailable,
      location: null,
    };
  }

  const fallbackLocation: IDriverLiveLocation | null = redisLocation
    ? redisLocation
    : driver?.lastKnownLocation?.lat != null &&
        driver?.lastKnownLocation?.lng != null
      ? {
          lat: driver.lastKnownLocation.lat,
          lng: driver.lastKnownLocation.lng,
          heading: null,
          speed: null,
          updatedAt: driver.lastKnownLocation.updatedAt
            ? new Date(driver.lastKnownLocation.updatedAt).getTime()
            : 0,
        }
      : null;

  return {
    isOnDuty: true,
    isStale: !isFreshLocation(fallbackLocation?.updatedAt),
    isFallback: true,
    isRedisAvailable,
    location: fallbackLocation,
  };
};

const canJoinBooking = async (user: JwtPayload, bookingId: string) => {
  const booking = await Booking.findById(bookingId)
    .select("userId driverId")
    .lean();
  if (!booking) return null;

  const allowed =
    String(booking.userId) === user.id ||
    String(booking.driverId) === user.id ||
    user.role === "SUPER_ADMIN";

  if (!allowed) return null;
  return booking;
};

export const DriverDutyService = {
  toggleDuty,
  updateLocation,
  readDriverLiveTracking,
  canJoinBooking,
  getTrackingBookingsForUser,
};
