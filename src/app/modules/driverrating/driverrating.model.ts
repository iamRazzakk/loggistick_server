import { Schema, model } from "mongoose";
import { IDriverrating, DriverratingModel } from "./driverrating.interface";

const driverratingSchema = new Schema<IDriverrating, DriverratingModel>(
  {
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Driverrating = model<IDriverrating, DriverratingModel>(
  "Driverrating",
  driverratingSchema,
);
