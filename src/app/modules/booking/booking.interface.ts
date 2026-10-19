import { Model, Types } from "mongoose";
import { AppointmentType } from "../../../enums/AppointmentType";
import { BookingStatus } from "../../../enums/BookingStatus";

export type IBooking = {
  userId: Types.ObjectId;
  pickupLocation: number[];
  dropOffLocation: number[];
  stopAddress?: number[];
  mobilityRequirements: Types.ObjectId;
  tripNote?: string;
  internalPrivateNote?: string;
  tripType: "one-way" | "round-trip";
  tripReason: AppointmentType;
  passengerSeats: number;
  payerSource: Types.ObjectId;
  programContext?: string;
  serviceDate: string;
  appointmentTime: string;
  pickupTime: string;
  returnTime?: string;
  recurringBooking: boolean;
  selectedDate?:
    | "saturday"
    | "sunday"
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | string[];
  endDate?: string;
  driverId?: Types.ObjectId;
  bookingStatus: BookingStatus;
  recurringBatchId?: string;

  /** Passenger co-pay. Kept so older clients that read `price` do not show the total. */
  price?: number;

  /** Server-calculated full fare. Hidden from the passenger role. */
  totalPrice?: number;
  passengerCoPay?: number;

  /** totalPrice - passengerCoPay. Hidden from the passenger role. */
  organizationContribution?: number;
  isApproved?: "pending" | "approved" | "rejected";
  paymentStatus?: "pending" | "paid" | "failed";

  /** Open Stripe Checkout session, so a retry does not create a second charge. */
  stripeCheckoutSessionId?: string;
  cancelledBy?: Types.ObjectId;
};

export type BookingModel = Model<IBooking>;
