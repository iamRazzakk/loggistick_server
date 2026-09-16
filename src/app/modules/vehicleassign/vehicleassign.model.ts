import { Schema, model } from "mongoose";
import { IVehicleAssign, VehicleAssignModel } from "./vehicleassign.interface";

const vehicleAssignSchema = new Schema<IVehicleAssign, VehicleAssignModel>(
  {
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
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

vehicleAssignSchema.index({ driverId: 1, vehicleId: 1 }, { unique: true });
export const VehicleAssign = model<IVehicleAssign, VehicleAssignModel>(
  "VehicleAssign",
  vehicleAssignSchema,
);
