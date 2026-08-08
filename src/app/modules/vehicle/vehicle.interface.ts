import { Model } from "mongoose";

export type IVehicle = {
  manufacturer: string;
  model: string;
  year: number;
  licensePlateNumber: string;
  vinNumber: string;
  configurationType: "ambulatory_van" | "wheelchair_van" | "stretcher_van";
  maxPassengers: number;
  odometer: number;
  nextServiceDate: Date;
  carrierProvider: string;
  policyNumber: string;
  insuranceExpirationDate: Date;
  isActive: boolean;
};

export type VehicleModel = Model<IVehicle>;
