import { z } from "zod";

const vehicleAssignZodSchema = z.object({
  body: z.object({
    driverId: z.string({
      required_error: "Driver ID is required",
    }),
    vehicleId: z.string({
      required_error: "Vehicle ID is required",
    }),
    assignedAt: z.string({
      required_error: "Assigned At is required",
    }),
    assignedBy: z.string({
      required_error: "Assigned By is required",
    }),
  }),
});

const createVehicleAssignZodSchema = z.object({
  body: vehicleAssignZodSchema,
});

const updateVehicleAssignZodSchema = z.object({
  params: z.object({
    id: z.string({
      required_error: "ID is required",
    }),
  }),
  body: vehicleAssignZodSchema.optional(),
});

export const VehicleAssignValidations = {
  createVehicleAssignZodSchema,
  updateVehicleAssignZodSchema,
};
