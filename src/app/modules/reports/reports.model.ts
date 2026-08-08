import { Schema, model } from "mongoose";
import { IReports, ReportsModel } from "./reports.interface";

const reportsSchema = new Schema<IReports, ReportsModel>(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    documents: {
      type: String,
      required: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
  },
  { timestamps: true },
);
reportsSchema.index({ driverId: 1, reportedBy: 1 });
export const Reports = model<IReports, ReportsModel>("Reports", reportsSchema);
