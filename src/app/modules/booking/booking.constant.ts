import { USER_ROLES } from "../../../enums/user";
import { IBooking } from "./booking.interface";

export const BOOKING_STATUSES = [
  "pending",
  "assigned",
  "in-progress",
  "confirmed",
  "cancelled",
  "trip-completed",
  "completed",
] as const;

export const WEEKDAYS = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export const LOCKED_FARE_FIELDS = [
  "price",
  "totalPrice",
  "passengerCoPay",
  "organizationContribution",
  "paymentStatus",
  "stripeCheckoutSessionId",
] as const;

export const STAFF = new Set<string>([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.DISPATCHER,
]);




export const NEXT_STATUS: Record<
  IBooking["bookingStatus"],
  IBooking["bookingStatus"][]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["completed", "cancelled"],
  "in-progress": ["trip-completed", "cancelled"],
  "trip-completed": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
