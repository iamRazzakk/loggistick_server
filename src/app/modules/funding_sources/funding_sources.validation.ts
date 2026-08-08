import { z } from "zod";
const FundingSourcesZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }),
  type: z.enum(
    ["government", "county", "municipal", "facility", "private", "other"],
    { required_error: "Type is required" },
  ),
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
