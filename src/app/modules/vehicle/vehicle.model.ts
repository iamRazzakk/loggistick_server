import { Schema, model } from "mongoose";
import { IVehicle, VehicleModel } from "./vehicle.interface";

const vehicleSchema = new Schema<IVehicle, VehicleModel>(
  {
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    licensePlateNumber: { type: String, required: true },
    vinNumber: { type: String, required: true },
    configurationType: { type: String, required: true },
    maxPassengers: { type: Number, required: true },
    odometer: { type: Number, required: true },
    nextServiceDate: { type: Date, required: true },
    carrierProvider: { type: String, required: true },
    policyNumber: { type: String, required: true },
    insuranceExpirationDate: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  },
);
vehicleSchema.index({ licensePlateNumber: 1 }, { unique: true });
export const Vehicle = model<IVehicle, VehicleModel>("Vehicle", vehicleSchema);
