export const STORED_BOOKING_STATUSES = [
  "pending",
  "assigned",
  "in-progress",
  "confirmed",
  "cancelled",
  "trip-started",
  "trip-completed",
  "completed",
  "no-show",
] as const;

export const CLOSED_BOOKING_STATUSES = ["cancelled", "completed", "trip-completed", "no-show"];
