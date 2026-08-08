import { Schema, model } from "mongoose";
import {
  AppointmentType,
  BookingModel,
  County,
  IBooking,
} from "./booking.interface";

const bookingSchema = new Schema<IBooking, BookingModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    mobilityRequirements: {
      type: String,
      enum: ["ambulatory", "wheelchair", "walker", "rollator", "cane"],
      required: true,
    },
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
    fundingSource: {
      type: Schema.Types.ObjectId,
      ref: "FundingSources",
      required: true,
    },
    countryJurisdiction: {
      type: String,
      enum: Object.values(County),
      required: true,
    },
    programContext: {
      type: Schema.Types.ObjectId,
      ref: "FacilitiesAndPrograms",
      required: true,
    },
    tripJurisdiction: {
      type: Boolean,
      required: true,
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
      required: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      required: true,
      default: "pending",
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
