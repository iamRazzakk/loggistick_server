import { z } from "zod";

const mobilityZodSchema = z.object({
  name: z.string({
    required_error: "Name is required",
  }),
  price: z.coerce.number({
    required_error: "Price is required",
  }),
  //   icon: z
  //     .string({
  //       required_error: "Icon is required",
  //     })
  //     .optional(),
  status: z.boolean().optional(),
});

const createMobilityZodSchema = z.object({
  body: mobilityZodSchema,
});

const updateMobilityZodSchema = z.object({
  body: mobilityZodSchema.partial(),
});

export const MobilityValidations = {
  createMobilityZodSchema,
  updateMobilityZodSchema,
};
