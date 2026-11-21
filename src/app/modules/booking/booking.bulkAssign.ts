import { UnrecoverableError } from "bullmq";
import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import { Booking } from "./booking.model";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enums/user";
import { isDriverOnDuty } from "../driverduty/driverduty.cache";
import { countyIdsFromQuery } from "./booking.query";
import { sendPushNotification } from "../../../helpers/notificationsHelper";
import {
  collectSystemLogChanges,
  SystemLogServices,
} from "../systemLog/systemLog.service";

export type BulkAssignPayload = {
  bookingIds?: string[];
  driverIds?: string[];
  countyId?: string;
};

export type BulkAssignResult = {
  totalBookings: number;
  totalDrivers: number;
  assigned: number;
  skipped: string[];
  assignments: { bookingId: string; driverId: string; driverName: string }[];
};

/**
 * Randomly assign on-duty drivers to unassigned, approved bookings.
 * Drivers are shuffled and handed one booking at a time (round-robin), so the
 * load is spread evenly. Each driver gets a push for every trip they receive.
 */
const shuffle = <T>(list: T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const toObjectIds = (ids?: string[]) =>
  (ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

export const bulkAssignDrivers = async (
  user: JwtPayload,
  payload: BulkAssignPayload,
): Promise<BulkAssignResult> => {
  // 1. On-duty drivers (User.isOnDuty is synced from duty sessions; re-check cache).
  const driverFilter: Record<string, unknown> = {
    role: USER_ROLES.DRIVER,
    isOnDuty: true,
  };
  const pickedDrivers = toObjectIds(payload.driverIds);
  if (pickedDrivers.length) driverFilter._id = { $in: pickedDrivers };
  const candidates = await User.find(driverFilter)
    .select("firstName lastName")
    .lean();
  const onDutyFlags = await Promise.all(
    candidates.map((d) => isDriverOnDuty(String(d._id))),
  );
  const drivers = shuffle(candidates.filter((_, i) => onDutyFlags[i]));
  if (!drivers.length) {
    throw new UnrecoverableError(
      "No active (on-duty) drivers available to assign.",
    );
  }

  // 2. Unassigned, approved bookings (optionally limited to the given ids / county).
  const bookingFilter: Record<string, unknown> = {
    isApproved: "approved",
    bookingStatus: { $in: ["confirmed", "assigned"] },
    driverId: { $in: [null] },
  };
  const pickedBookings = toObjectIds(payload.bookingIds);
  if (pickedBookings.length) bookingFilter._id = { $in: pickedBookings };
  const countyIds = countyIdsFromQuery(payload.countyId);
  if (countyIds.length) bookingFilter.countyId = { $in: countyIds };

  const bookings = await Booking.find(bookingFilter)
    .select("_id serviceDate pickupTime")
    .sort({ serviceDate: 1, pickupTime: 1 })
    .lean();
  if (!bookings.length) {
    throw new UnrecoverableError(
      "No unassigned bookings found to assign.",
    );
  }

  // 3. One booking at a time, round-robin across the shuffled drivers.
  const assignments: {
    bookingId: string;
    driverId: string;
    driverName: string;
  }[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < bookings.length; i += 1) {
    const booking = bookings[i];
    const driver = drivers[i % drivers.length];
    const driverId = String(driver._id);

    // Guard against a race: only take the booking if it is still unassigned.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, driverId: { $in: [null] } },
      { driverId: driver._id, bookingStatus: "assigned" },
      { new: true },
    ).lean();
    if (!updated) {
      skipped.push(String(booking._id));
      continue;
    }

    const bookingId = String(booking._id);
    assignments.push({
      bookingId,
      driverId,
      driverName: `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim(),
    });

    await SystemLogServices.createSystemLogIntoDB({
      actor: user,
      action: "UPDATE",
      module: "booking",
      entityType: "Booking",
      entityId: bookingId,
      description: `Bulk-assigned booking ${bookingId} to driver ${driverId}`,
      changes: collectSystemLogChanges(
        { driverId: null, bookingStatus: "confirmed" },
        { driverId, bookingStatus: "assigned" },
        ["driverId", "bookingStatus"],
      ),
    });

    const when = [booking.serviceDate, booking.pickupTime]
      .filter(Boolean)
      .join(" ");
    await sendPushNotification({
      userIds: driverId,
      title: "New trip assigned",
      body: when
        ? `You have been assigned trip #${bookingId.slice(-6)} on ${when}.`
        : `You have been assigned trip #${bookingId.slice(-6)}.`,
      data: { screen: "booking", referenceId: bookingId },
    });
  }

  return {
    totalBookings: bookings.length,
    totalDrivers: drivers.length,
    assigned: assignments.length,
    skipped,
    assignments,
  };
};
