import { z } from "zod";

const driverRatingZodSchema = z.object({
  body: z.object({
    driverId: z.string({
      required_error: "Driver ID is required",
    }),
    tripId: z.string({
      required_error: "Trip ID is required",
    }),
    rating: z.number({
      required_error: "Rating is required",
    }),
    comment: z.string({
      required_error: "Comment is required",
    }),
  }),
});

const createDriverRatingZodSchema = z.object({
  body: driverRatingZodSchema.shape.body.strict(),
});

const updateDriverRatingZodSchema = z.object({
  params: z.object({
    id: z.string({
      required_error: "ID is required",
    }),
  }),
  body: driverRatingZodSchema.shape.body.partial(),
});

export const DriverratingValidations = {
  createDriverRatingZodSchema,
  updateDriverRatingZodSchema,
};
