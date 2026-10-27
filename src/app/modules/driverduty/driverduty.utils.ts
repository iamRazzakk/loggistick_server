import { format, isValid, parse } from "date-fns";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { DUTY_DATE_FORMAT } from "./driverduty.constants";
import {
  IDriverDuty,
  IDutyDuration,
  IPresentedDriverDuty,
} from "./driverduty.interface";

export const getDutyDate = (date: Date = new Date()) =>
  format(date, DUTY_DATE_FORMAT);

const DATE_FORMATS = [
  "yyyy-MM-dd",
  "yyyy/MM/dd",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "MM-dd-yyyy",
  "dd-MM-yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
  "d MMM yyyy",
  "d MMMM yyyy",
];

const isRealDate = (date: Date) =>
  isValid(date) && !Number.isNaN(date.getTime());

export const normalizeDutyDate = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  for (const dateFormat of DATE_FORMATS) {
    const parsed = parse(raw, dateFormat, new Date());
    if (isRealDate(parsed)) {
      return format(parsed, DUTY_DATE_FORMAT);
    }
  }

  const fallback = new Date(raw);
  if (isRealDate(fallback)) {
    return format(fallback, DUTY_DATE_FORMAT);
  }

  throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid date: ${raw}`);
};

export const getDurationMs = (start: Date, end: Date) =>
  Math.max(0, end.getTime() - new Date(start).getTime());

export const splitDuration = (totalMs: number): IDutyDuration => {
  const safe = Math.max(0, Math.floor(totalMs));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);

  return {
    hours,
    minutes,
    seconds,
    totalMs: safe,
    formatted: `${hours}h ${String(minutes).padStart(2, "0")}m`,
  };
};

export const presentDriverDuty = (
  duty: IDriverDuty & { _id?: unknown },
  now: Date = new Date(),
): IPresentedDriverDuty => {
  const sessions = (duty.sessions ?? []).map((session) => {
    const end = session.endTime ? new Date(session.endTime) : now;
    const durationMs = session.endTime
      ? session.durationMs || getDurationMs(session.startTime, end)
      : getDurationMs(session.startTime, now);

    return {
      startTime: session.startTime,
      endTime: session.endTime,
      duration: splitDuration(durationMs),
    };
  });

  const completedMs = duty.totalDurationMs || 0;
  const openSession = (duty.sessions ?? []).find((session) => !session.endTime);
  const liveMs = openSession
    ? getDurationMs(openSession.startTime, now)
    : 0;

  const firstSession = duty.sessions?.[0];
  const lastClosed = [...(duty.sessions ?? [])]
    .reverse()
    .find((session) => session.endTime);

  return {
    _id: duty._id as IPresentedDriverDuty["_id"],
    driverId: duty.driverId,
    date: duty.date,
    isOnDuty: Boolean(openSession),
    firstStartTime: firstSession?.startTime ?? null,
    lastEndTime: lastClosed?.endTime ?? null,
    sessions,
    totalDuration: splitDuration(completedMs + liveMs),
  };
};
