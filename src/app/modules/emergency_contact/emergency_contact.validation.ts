import { z } from "zod";
import { EMERGENCY_RELATIONSHIPS } from "./emergency_contact.constants";

const emergencyContactZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1),
  relationship: z.enum(EMERGENCY_RELATIONSHIPS, {
    required_error: "Relationship is required",
  }),
  contactNumber: z
    .string({ required_error: "Contact number is required" })
    .min(1),
});

const createEmergencyContactZodSchema = z.object({
  body: emergencyContactZodSchema,
});

export const EmergencyContactValidations = {
  createEmergencyContactZodSchema,
};
