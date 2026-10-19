import { eachDayOfInterval, format, parseISO } from "date-fns";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * PREVIOUS IMPLEMENTATION
 * parseISO + eachDayOfInterval + format(..., "EEEE").
 * A date-only string is UTC midnight, then date-fns formats it in the
 * server timezone, so a occurrence could land on the previous or next day.
 *
 * NEW IMPLEMENTATION
 * Walk YYYY-MM-DD in UTC. Every occurrence keeps the booking's own
 * appointmentTime / pickupTime; only serviceDate changes. There is still
 * no per-day appointment field. Do not add one until that rule exists.
 */

const parseUtcDate = (value: string) => {
  const match = DATE_ONLY.exec(String(value ?? "").trim());
  if (!match) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  return date;
};
export const generateRecurringDates = (
  startDate: string,
  endDate: string,
  selectedDays: string[],
): string[] => {
  if (!selectedDays?.length) return [];
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (end.getTime() < start.getTime()) return [];
  const selected = new Set(selectedDays.map((day) => day?.toLowerCase()));
  const dates: string[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
    const date = new Date(time);
    const dayName = WEEKDAYS[date.getUTCDay()];
    if (!selected.has(dayName)) continue;
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};
