export const STORED_BOOKING_STATUSES = [
  "pending",
  "assigned",
  "in-progress",
  "confirmed",
  "cancelled",
  "trip-completed",
  "completed",
] as const;

export const CLOSED_BOOKING_STATUSES = ["cancelled", "completed", "trip-completed"];
