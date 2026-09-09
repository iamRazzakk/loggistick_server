import { z } from "zod";

const payersZodSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "government",
    "country_payer",
    "city",
    "insurance",
    "self_pay",
    "facility",
    "other",
  ]),
  isActive: z.boolean().default(true),
});

const createPayersZodSchema = z.object({
  body: payersZodSchema.strict(),
});

const updatePayersZodSchema = z.object({
  body: payersZodSchema.partial(),
});

export const PayersValidations = {
  createPayersZodSchema,
  updatePayersZodSchema,
};