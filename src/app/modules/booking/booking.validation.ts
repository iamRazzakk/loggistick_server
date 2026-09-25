import { z } from "zod";
import { AppointmentType } from "./booking.interface";
import { checkValidID } from "../../../shared/checkValidID";

const WEEKDAYS = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

const TRIP_TYPES = ["one-way", "round-trip"] as const;
const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
] as const;
const APPOINTMENT_TYPES = Object.values(AppointmentType) as [
  AppointmentType,
  ...AppointmentType[],
];

const bookingBodySchema = z.object({
  userId: checkValidID("Valid userId is required").optional(),

  pickupLocation: z.number({
    required_error: "Pickup location is required",
  }),
  dropOffLocation: z.number({
    required_error: "Drop off location is required",
  }),
  stopAddress: z.number().optional(),

  mobilityRequirements: checkValidID("Valid mobilityRequirements is required"),

  tripNote: z.string().optional(),
  internalPrivateNote: z.string().optional(),

  tripType: z.enum(TRIP_TYPES, {
    required_error: "Trip type is required",
  }),
  tripReason: z.enum(APPOINTMENT_TYPES, {
    required_error: "Trip reason is required",
  }),
  passengerSeats: z
    .number({ required_error: "Passenger seats is required" })
    .int()
    .min(1, { message: "Passenger seats must be at least 1" }),

  payerSource: z.string().optional(),
  programContext: z.string().optional(),

  serviceDate: z.string({
    required_error: "Service date is required",
  }),
  appointmentTime: z.string({
    required_error: "Appointment time is required",
  }),
  pickupTime: z.string({
    required_error: "Pickup time is required",
  }),
  returnTime: z.string().optional(),

  recurringBooking: z.boolean().optional().default(false),
  selectedDate: z.array(z.enum(WEEKDAYS)).optional(),
  endDate: z.string().optional(),

  driverId: checkValidID("Valid driverId is required").optional(),

  bookingStatus: z.enum(BOOKING_STATUSES).optional().default("pending"),

  recurringBatchId: z.string().optional(),
  price: z.number().optional().default(0),
});

const bookingBodyRefine = (
  data: z.infer<typeof bookingBodySchema>,
  ctx: z.RefinementCtx,
) => {
  if (data.tripType === "round-trip" && !data.returnTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["returnTime"],
      message: "Return time is required when trip type is round-trip",
    });
  }

  if (data.recurringBooking) {
    if (!data.selectedDate || data.selectedDate.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedDate"],
        message: "Please select at least one recurring day",
      });
    }

    if (!data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is required for recurring booking",
      });
    }
  }
};

const createBookingZodSchema = z.object({
  body: bookingBodySchema.superRefine(bookingBodyRefine),
});

const updateBookingZodSchema = z.object({
  body: bookingBodySchema.partial(),
});

export const BookingValidations = {
  createBookingZodSchema,
  updateBookingZodSchema,
};
