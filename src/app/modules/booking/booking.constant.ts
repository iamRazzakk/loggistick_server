import { USER_ROLES } from "../../../enums/user";
import { IBooking } from "./booking.interface";

export const BOOKING_STATUSES = [
  "pending",
  "assigned",
  "in-progress",
  "confirmed",
  "cancelled",
  "trip-started",
  "trip-completed",
  "completed",
  // Driver arrived, passenger did not show up (PDF §41). Closed status.
  "no-show",
] as const;

/** Statuses a booking may be in when it is marked no-show (passenger not picked up yet). */
export const NO_SHOW_FROM_STATUSES = [
  "assigned",
  "confirmed",
  "in-progress",
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
  "totalPrice",
  "passengerCoPay",
  "organizationContribution",
  "paymentStatus",
  "stripeCheckoutSessionId",
  "calculatedRouteMileage",
  "straightLineMileage",
  "billingMileage",
  "billingMileageSource",
  "pricingLegs",
  "cancellationOutcome",
  "noShowOutcome",
] as const;

export const STAFF = new Set<string>([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.DISPATCHER,
]);
// @ts-ignore
export const NEXT_STATUS: Record<
  IBooking["bookingStatus"],
  IBooking["bookingStatus"][]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["completed", "cancelled", "no-show"],
  "in-progress": ["trip-completed", "cancelled", "no-show"],
  "trip-completed": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  "no-show": [],
};
