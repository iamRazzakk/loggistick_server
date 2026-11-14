import { z } from "zod";
import { checkValidID } from "../../../shared/checkValidID";

const FundingSourcesZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }),
  type: z.enum(
    ["government", "county", "municipal", "facility", "private", "other"],
    { required_error: "Type is required" },
  ),
  programName: z.string().optional(),
  description: z.string().optional(),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  effectiveUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  defaultCountyId: checkValidID("Valid defaultCountyId is required")
    .nullable()
    .optional(),
  status: z.boolean({ required_error: "Status is required" }).default(true),
});

const createFundingSourcesZodSchema = z.object({
  body: FundingSourcesZodSchema,
});

const updateFundingSourcesZodSchema = z.object({
  body: FundingSourcesZodSchema.partial(),
});

export const FundingSourcesValidations = {
  createFundingSourcesZodSchema,
  updateFundingSourcesZodSchema,
};
