import { Model, Types } from "mongoose";
import { AppointmentType } from "../../../enums/AppointmentType";
import { BookingStatus } from "../../../enums/BookingStatus";
import { ChargeOutcome, PricedLeg } from "./pricing/tripPricing";

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
  /** Payer org for this trip (County.payersId / booking create). */
  payerSource?: Types.ObjectId;
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

  /**
   * Rider-facing copay only (what the passenger pays).
   * Customer app shows this amount — not `totalPrice` / org share.
   */
  passengerCoPay?: number;

  /**
   * Full trip price for the booking (billable total).
   * Prefer this name over legacy aliases when reading/writing fare totals.
   */
  totalPrice?: number;

  /**
   * Funding-source / county share of the trip (full FS charge; copay is not subtracted).
   * Hidden from the passenger role. With `passengerCoPay`, makes up `totalPrice`.
   */
  organizationContribution?: number;
  calculatedRouteMileage?: number | null;
  actualGpsMileage?: number | null;
  straightLineMileage?: number;
  billingMileage?: number;
  billingMileageSource?: string;
  pricingLegs?: PricedLeg[];
  cancellationOutcome?: ChargeOutcome;
  noShowOutcome?: ChargeOutcome;
  isApproved?: "pending" | "approved" | "rejected";
  paymentStatus?: "pending" | "paid" | "failed";

  /** Open Stripe Checkout session, so a retry does not create a second charge. */
  stripeCheckoutSessionId?: string;
  countyId?: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  driverArrivedAt?: string;
  driverPicupAt?: string;
};

export type BookingModel = Model<IBooking>;
