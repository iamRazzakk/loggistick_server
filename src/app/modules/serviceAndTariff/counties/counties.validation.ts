import { z } from "zod";

const countyZodSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: "County / City Name is required",
    }),

    state: z.string({
      required_error: "State is required",
    }),

    baseFare: z.coerce.number({
      required_error: "Base fare is required",
    }),

    internalNotes: z.string().optional(),

    boundary: z.object({
      type: z.enum(["Polygon", "MultiPolygon"]),
      coordinates: z.array(z.any()),
    }),

    isActive: z.boolean().optional(),
  }),
});

const createCountyZodSchema = z.object({
  body: countyZodSchema.shape.body,
});

const updateCountyZodSchema = z.object({
  body: countyZodSchema.shape.body.partial(),
});

export const CountiesValidation = {
  createCountyZodSchema,
  updateCountyZodSchema,
};

