import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { User } from "../user/user.model";
import { County } from "../serviceAndTariff/counties/counties.model";
import { format } from "date-fns";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDay = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd");
  }
  const str = String(value).trim();
  if (!str) return undefined;
  if (DAY.test(str)) return str;
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  return undefined;
};

const queryDay = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  const day = parseDay(value);
  if (!day) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${field} must be yyyy-MM-dd`,
    );
  }
  return day;
};

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
    const counties = await County.find({
      payersId: new Types.ObjectId(payerId),
    })
      .select("_id")
      .lean();
    filter.countyId = { $in: counties.map((county) => county._id) };
  }

  const selectedDateObj =
    typeof query.selectedDate === "object" &&
    query.selectedDate !== null &&
    !Array.isArray(query.selectedDate)
      ? query.selectedDate
      : undefined;

  let rawStart =
    query.startDate ??
    query.from ??
    selectedDateObj?.startDate ??
    selectedDateObj?.from;
  let rawEnd =
    query.endDate ??
    query.to ??
    selectedDateObj?.endDate ??
    selectedDateObj?.to;

  if (!rawStart && !rawEnd && typeof query.selectedDate === "string") {
    const rangeMatch = query.selectedDate.match(
      /^(\d{4}-\d{2}-\d{2}(?:T[^\s]+)?)\s*(?:-|to)\s*(\d{4}-\d{2}-\d{2}(?:T[^\s]+)?)$/i,
    );
    if (rangeMatch) {
      rawStart = rangeMatch[1];
      rawEnd = rangeMatch[2];
    }
  }

  const startDate = queryDay(rawStart, "startDate");
  const endDate = queryDay(rawEnd, "endDate");
  if (startDate && endDate && startDate > endDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "startDate must be on or before endDate",
    );
  }
  if (startDate || endDate) {
    filter.serviceDate = {
      ...(startDate ? { $gte: startDate } : {}),
      ...(endDate ? { $lte: endDate } : {}),
    };
  } else {
    const rawDates: unknown[] = [];
    const candidates = [
      query.serviceDate,
      query.selectedDate,
      query.date,
      query.selectedDates,
    ];
    for (const c of candidates) {
      if (c === undefined || c === null || c === "") continue;
      if (Array.isArray(c)) {
        rawDates.push(...c);
      } else if (typeof c === "string") {
        rawDates.push(...c.split(","));
      } else {
        rawDates.push(c);
      }
    }

    const parsedDays = rawDates
      .map(parseDay)
      .filter((d): d is string => Boolean(d));

    if (parsedDays.length === 1) {
      filter.serviceDate = parsedDays[0];
    } else if (parsedDays.length > 1) {
      filter.serviceDate = { $in: Array.from(new Set(parsedDays)) };
    }
  }

  const ids =
    query.ids ?? query.bookingIds ?? query.tripIds ?? query.selectedIds;
  if (ids) {
    const rawIds = Array.isArray(ids) ? ids : String(ids).split(",");
    const validIds = rawIds
      .map((id) => String(id).trim())
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (validIds.length > 0) {
      filter._id = { $in: validIds };
    }
  }
  const term = String(query.searchTerm ?? "").trim();
  if (!term) return filter;
  const or: Record<string, unknown>[] = [];
  // 2–6 hex chars anywhere in the last 6 of the trip _id
  if (/^[a-f0-9]{2,6}$/i.test(term)) {
    or.push({
      $expr: {
        $regexMatch: {
          input: {
            $substrCP: [
              { $toString: "$_id" },
              {
                $subtract: [{ $strLenCP: { $toString: "$_id" } }, 6],
              },
              6,
            ],
          },
          regex: escapeRegex(term),
          options: "i",
        },
      },
    });
  } else if (/^[a-f0-9]{24}$/i.test(term) && Types.ObjectId.isValid(term)) {
    or.push({ _id: new Types.ObjectId(term) });
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




export const buildApprovedBookingFilter = async (searchTerm?: string) => {
  const filter: Record<string, unknown> = {
    bookingStatus: { $in: ["confirmed", "assigned"] },
    isApproved: "approved",
  };
  const term = String(searchTerm ?? "").trim();
  if (!term) return filter;

  const or: Record<string, unknown>[] = [];

  // 2–6 hex chars anywhere in the last 6 of _id.
  // "5e", "900", "003", and "5e9003" all hit ...5e9003
  if (/^[a-f0-9]{2,6}$/i.test(term)) {
    or.push({
      $expr: {
        $regexMatch: {
          input: {
            $substrCP: [
              { $toString: "$_id" },
              {
                $subtract: [{ $strLenCP: { $toString: "$_id" } }, 6],
              },
              6,
            ],
          },
          regex: escapeRegex(term),
          options: "i",
        },
      },
    });
  } else if (/^[a-f0-9]{24}$/i.test(term) && Types.ObjectId.isValid(term)) {
    or.push({ _id: new Types.ObjectId(term) });
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