import { z } from "zod";

const CompanySupportZodSchema = z.object({
  supportEmail: z
    .string({ required_error: "Support email is required" })
    .email("Invalid email address")
    .optional(),
  helplineNumber: z.string().optional(),
  dispatcherDirectLine: z.string().optional(),
  emergencyHotline: z.string().optional(),
  generalOfficeLine: z.string().optional(),
  organizationName: z.string().optional(),
  headquartersAddress: z.string().optional(),
});

const upsertCompanySupportZodSchema = z.object({
  body: CompanySupportZodSchema,
});

export const CompanySupportValidations = {
  upsertCompanySupportZodSchema,
};
