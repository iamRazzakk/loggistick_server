import { z } from "zod";

const geoFields = {
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
  heading: z.coerce.number().gte(0).lte(360).optional(),
  speed: z.coerce.number().min(0).optional(),
};

const toggleDutyZodSchema = z.object({
  body: z
    .object({
      isOnDuty: z.boolean({ required_error: "isOnDuty is required" }),
      ...geoFields,
    })
    .superRefine((data, ctx) => {
      if (data.isOnDuty && (data.lat == null || data.lng == null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lat"],
          message: "lat and lng are required when turning on duty",
        });
      }
    }),
});

const updateLocationZodSchema = z.object({
  body: z.object({
    lat: z.coerce.number().gte(-90).lte(90),
    lng: z.coerce.number().gte(-180).lte(180),
    heading: z.coerce.number().gte(0).lte(360).optional(),
    speed: z.coerce.number().min(0).optional(),
    bookingId: z.string().optional(),
  }),
});

export const DriverDutyValidations = {
  toggleDutyZodSchema,
  updateLocationZodSchema,
};
