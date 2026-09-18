import { errorLogger } from "../../../../shared/logger";
import { redisService } from "../../../../redis/redis.service";
import redisClient from "../../../../config/redis.config";
import { User } from "../../user/user.model";
import {
  DRIVER_DUTY_KEY,
  DRIVER_DUTY_TTL_SEC,
  DRIVER_LOC_KEY,
  DRIVER_LOC_TTL_SEC,
  DRIVER_PERSIST_LOCK,
  IDriverLiveLocation,
} from "./driverDuty.interface";

const REDIS_TIMEOUT_MS = 300;

export const isFreshLocation = (updatedAt?: number) =>
  !!updatedAt && Date.now() - updatedAt <= DRIVER_LOC_TTL_SEC * 1000;

const isRedisReady = () => redisClient.status === "ready";

const withTimeout = async <T>(task: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Redis timeout")),
      REDIS_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

export const parseLiveLocation = (
  raw: string | null,
): IDriverLiveLocation | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IDriverLiveLocation;
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const redisGet = async (
  key: string,
): Promise<{ ok: boolean; value: string | null }> => {
  if (!isRedisReady()) {
    return { ok: false, value: null };
  }
  try {
    const value = await withTimeout(redisService.get(key));
    return { ok: true, value };
  } catch (error) {
    errorLogger.error(`Redis GET failed for ${key}: ${error}`);
    return { ok: false, value: null };
  }
};

export const redisSet = async (
  key: string,
  value: string,
  expiration: number,
) => {
  if (!isRedisReady()) return false;
  try {
    await withTimeout(redisService.post({ key, value, expiration }));
    return true;
  } catch (error) {
    errorLogger.error(`Redis SET failed for ${key}: ${error}`);
    return false;
  }
};

export const redisDel = async (...keys: string[]) => {
  if (!isRedisReady()) return false;
  try {
    await withTimeout(Promise.all(keys.map((key) => redisService.del(key))));
    return true;
  } catch (error) {
    errorLogger.error(`Redis DEL failed: ${error}`);
    return false;
  }
};

export const writeLiveToRedis = async (
  driverId: string,
  live: IDriverLiveLocation,
) => {
  const locOk = await redisSet(
    DRIVER_LOC_KEY(driverId),
    JSON.stringify(live),
    DRIVER_LOC_TTL_SEC,
  );
  await redisSet(DRIVER_DUTY_KEY(driverId), "1", DRIVER_DUTY_TTL_SEC);
  return locOk;
};

export const removeLiveFromRedis = async (driverId: string) => {
  return redisDel(
    DRIVER_DUTY_KEY(driverId),
    DRIVER_LOC_KEY(driverId),
    DRIVER_PERSIST_LOCK(driverId),
  );
};

export const readDutyFromMongo = async (driverId: string) => {
  try {
    return await User.findById(driverId)
      .select("isOnDuty lastKnownLocation")
      .lean();
  } catch (error) {
    errorLogger.error(`Mongo duty read failed for ${driverId}: ${error}`);
    return null;
  }
};

export const saveLastKnownLocation = async (
  driverId: string,
  live: IDriverLiveLocation,
  isOnDuty?: boolean,
) => {
  try {
    const update: Record<string, unknown> = {
      lastKnownLocation: {
        lat: live.lat,
        lng: live.lng,
        updatedAt: new Date(live.updatedAt),
      },
    };
    if (typeof isOnDuty === "boolean") {
      update.isOnDuty = isOnDuty;
    }
    await User.findByIdAndUpdate(driverId, update);
    return true;
  } catch (error) {
    errorLogger.error(`Mongo location save failed for ${driverId}: ${error}`);
    return false;
  }
};
