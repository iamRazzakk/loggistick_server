import { Schema, model } from "mongoose";
import {
  AppointmentType,
  BookingModel,
  County,
  IBooking,
} from "./booking.interface";

const bookingSchema = new Schema<IBooking, BookingModel>(
  {
    // user data
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // pickup and drop off and county coverage
    pickupLocation: {
      type: Number,
      required: true,
    },
    dropOffLocation: {
      type: Number,
      required: true,
    },
    stopAddress: {
      type: Number,
      required: false,
    },

    // mobility requirements
    mobilityRequirements: {
      type: Schema.Types.ObjectId,
      ref: "Mobility",
      required: true,
    },

    // note
    tripNote: {
      type: String,
      required: false,
    },
    internalPrivateNote: {
      type: String,
      required: false,
    },

    tripType: {
      type: String,
      enum: ["one-way", "round-trip"],
      required: true,
    },
    tripReason: {
      type: String,
      enum: Object.values(AppointmentType),
      required: true,
    },
    passengerSeats: {
      type: Number,
      required: true,
    },
    payerSource: {
      type: Schema.Types.ObjectId,
      ref: "Payers",
      required: false,
    },
    programContext: {
      type: String,
      required: false,
    },
    serviceDate: {
      type: String,
      required: true,
    },
    appointmentTime: {
      type: String,
      required: true,
    },
    pickupTime: {
      type: String,
      required: true,
    },
    returnTime: {
      type: String,
      required: false,
    },
    recurringBooking: {
      type: Boolean,
      required: true,
      default: false,
    },
    selectedDate: {
      type: [String],
      enum: [
        "saturday",
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
      ],
      required: false,
    },
    endDate: {
      type: String,
      required: false,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    bookingStatus: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "in-progress",
        "confirmed",
        "cancelled",
        "completed",
      ],
      required: true,
      default: "pending",
    },
    recurringBatchId: {
      type: String,
      required: false,
      index: true,
    },

    price: {
      type: Number,
      required: false,
      default: 0,
    },
    isApproved: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: false,
    },
  },
  {
    timestamps: true,
  },
);
//
bookingSchema.index({ userId: 1 });
bookingSchema.index({ driverId: 1 });
bookingSchema.index({ vehicleId: 1 });
bookingSchema.index({ serviceDate: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ driverId: 1, serviceDate: 1 });
bookingSchema.index({ userId: 1, serviceDate: 1 });
bookingSchema.index({ bookingStatus: 1, serviceDate: 1 });
export const Booking = model<IBooking, BookingModel>("Booking", bookingSchema);
