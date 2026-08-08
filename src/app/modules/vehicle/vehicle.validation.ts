import { z } from "zod";

const vehicleBodySchema = z.object({
  manufacturer: z.string({ required_error: "Manufacturer is required" }),
  model: z.string({ required_error: "Model is required" }),
  year: z.number({ required_error: "Year is required" }),
  licensePlateNumber: z.string({
    required_error: "License plate number is required",
  }),
  vinNumber: z.string({ required_error: "Vin number is required" }),
  configurationType: z.enum(
    ["ambulatory_van", "wheelchair_van", "stretcher_van"],
    { required_error: "Configuration type is required" },
  ),
  maxPassengers: z.number({ required_error: "Max passengers is required" }),
  odometer: z.number({ required_error: "Odometer is required" }),
  nextServiceDate: z.coerce.date({
    required_error: "Next service date is required",
  }),
  carrierProvider: z.string({
    required_error: "Carrier provider is required",
  }),
  policyNumber: z.string({ required_error: "Policy number is required" }),
  insuranceExpirationDate: z.coerce.date({
    required_error: "Insurance expiration date is required",
  }),
  isActive: z.boolean({ required_error: "isActive is required" }).default(true),
});

const createVehicleZodSchema = z.object({
  body: vehicleBodySchema,
});

const updateVehicleZodSchema = z.object({
  body: vehicleBodySchema.partial(),
});

export const VehicleValidations = {
  createVehicleZodSchema,
  updateVehicleZodSchema,
};
