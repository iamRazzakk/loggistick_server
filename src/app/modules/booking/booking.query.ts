import { User } from "../user/user.model";
import { Types } from "mongoose";
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildPendingBookingFilter = async (searchTerm?: string) => {
  const filter: Record<string, unknown> = { isApproved: "pending" };
  const term = String(searchTerm ?? "").trim();
  if (!term) return filter;

  const or: Record<string, unknown>[] = [];

  if (/^[a-f0-9]{6}$/i.test(term)) {
    or.push({
      $expr: {
        $regexMatch: {
          input: { $toString: "$_id" },
          regex: `${term}$`,
          options: "i",
        },
      },
    });
  }

  const nameParts = term.split(/\s+/).filter(Boolean);
  const matchedUsers = await User.find({
    $and: nameParts.map((part) => ({
      $or: ["firstName", "middleName", "lastName"].map((field) => ({
        [field]: { $regex: escapeRegex(part), $options: "i" },
      })),
    })),
  }).select("_id");

  if (matchedUsers.length) {
    or.push({ userId: { $in: matchedUsers.map((user) => user._id) } });
  }

  if (or.length) filter.$or = or;
  else filter._id = { $in: [] };

  return filter;
};

export const buildTripHistoryFilter = async (query: Record<string, any>) => {
  const filter: Record<string, unknown> = {
    driverId: { $exists: true, $ne: null },
    bookingStatus: { $ne: "pending" },
  };
  const driverId = String(query.driverId ?? "").trim();
  if (driverId && Types.ObjectId.isValid(driverId)) {
    filter.driverId = new Types.ObjectId(driverId);
  }
  const payerId = String(query.payerSource ?? query.payerId ?? "").trim();
  if (payerId && Types.ObjectId.isValid(payerId)) {
    filter.payerSource = new Types.ObjectId(payerId);
  }
  const serviceDate = String(query.serviceDate ?? "").trim();
  if (serviceDate) {
    filter.serviceDate = serviceDate;
  }
  const term = String(query.searchTerm ?? "").trim();
  if (!term) return filter;
  const or: Record<string, unknown>[] = [];
  // last 6 hex chars of booking _id, same rule as pending bookings
  if (/^[a-f0-9]{6}$/i.test(term)) {
    or.push({
      $expr: {
        $regexMatch: {
          input: { $toString: "$_id" },
          regex: `${term}$`,
          options: "i",
        },
      },
    });
  }
  const nameParts = term.split(/\s+/).filter(Boolean);
  const matchedUsers = await User.find({
    $and: nameParts.map((part) => ({
      $or: ["firstName", "middleName", "lastName"].map((field) => ({
        [field]: { $regex: escapeRegex(part), $options: "i" },
      })),
    })),
  }).select("_id");
  if (matchedUsers.length) {
    or.push({ userId: { $in: matchedUsers.map((user) => user._id) } });
  }
  if (or.length) filter.$or = or;
  else filter._id = { $in: [] };
  return filter;
};
