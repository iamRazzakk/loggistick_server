import { Schema, model } from "mongoose";
import { DriverDutyModel, IDriverDuty } from "./driverduty.interface";

const dutySessionSchema = new Schema(
  {
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const driverDutySchema = new Schema<IDriverDuty, DriverDutyModel>(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    sessions: {
      type: [dutySessionSchema],
      default: [],
    },
    totalDurationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    isOnDuty: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

driverDutySchema.index({ driverId: 1, date: 1 }, { unique: true });
driverDutySchema.index({ date: 1 });
driverDutySchema.index({ driverId: 1, isOnDuty: 1 });

export const DriverDuty = model<IDriverDuty, DriverDutyModel>(
  "DriverDuty",
  driverDutySchema,
);
