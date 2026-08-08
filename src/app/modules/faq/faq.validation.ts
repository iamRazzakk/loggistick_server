import { z } from "zod";

const faqBodySchema = z.object({
  question: z.string({ required_error: "Question is required" }),
  ans: z.string({ required_error: "Answer is required" }),
  role: z.enum(["DISPATCHER", "USER"], {
    required_error: "Role is required",
  }),
});

const createFaqZodSchema = z.object({
  body: faqBodySchema,
});

const updateFaqZodSchema = z.object({
  body: faqBodySchema.partial(),
});

export const FaqValidations = {
  createFaqZodSchema,
  updateFaqZodSchema,
};
