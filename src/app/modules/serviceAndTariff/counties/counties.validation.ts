import { z } from "zod";
import { checkValidID } from "../../../../shared/checkValidID";

const mileageBasedPriceItemSchema = z.object({
  starting_mileage: z.coerce
    .number({
      required_error: "Starting mileage is required",
    })
    .min(0, "Starting mileage must be 0 or greater"),
  first_miles_price: z.coerce
    .number({
      required_error: "First miles price is required",
    })
    .min(0, "First miles price must be 0 or greater"),
  per_mile_price: z.coerce
    .number({
      required_error: "Per mile price is required",
    })
    .min(0, "Per mile price must be 0 or greater"),
});

const mileageBasedPriceZodSchema = z.union([
  z
    .array(mileageBasedPriceItemSchema)
    .nonempty("At least one mileage band is required"),
  mileageBasedPriceItemSchema.transform((item) => [item]),
]);

const coversAreasGeoJSONZodSchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"], {
    required_error: "GeoJSON type is required",
  }),
  coordinates: z.array(z.any(), {
    required_error: "GeoJSON coordinates are required",
  }),
});

const countyBodyBaseSchema = z.object({
  payersId: checkValidID("Valid payersId is required"),

  coversAreasGeoJSON: coversAreasGeoJSONZodSchema,

  priceMethod: z.enum(["flat_rate", "per_mile", "mileage_based"], {
    required_error: "Price method is required",
  }),

  flat_rate_price: z.coerce.number().optional(),
  starting_fare: z.coerce.number().optional(),
  first_miles_price: z.coerce.number().optional(),
  per_mile_price: z.coerce.number().optional(),
  mileage_based_price: mileageBasedPriceZodSchema.optional(),

  insidePrice: z.coerce.number().optional(),
  outsidePrice: z.coerce.number().optional(),
  // boolean already coerced in parseCountyUpload (FormData)
  isActive: z.boolean().optional().default(true),
});

const priceMethodRefine = (
  data: z.infer<typeof countyBodyBaseSchema>,
  ctx: z.RefinementCtx,
) => {
  if (data.priceMethod === "flat_rate" && data.flat_rate_price == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["flat_rate_price"],
      message: "flat_rate_price is required when priceMethod is flat_rate",
    });
  }

  if (data.priceMethod === "per_mile") {
    if (data.starting_fare == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["starting_fare"],
        message: "starting_fare is required when priceMethod is per_mile",
      });
    }
    if (data.first_miles_price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["first_miles_price"],
        message: "first_miles_price is required when priceMethod is per_mile",
      });
    }
    if (data.per_mile_price == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["per_mile_price"],
        message: "per_mile_price is required when priceMethod is per_mile",
      });
    }
  }

  if (data.priceMethod === "mileage_based") {
    if (
      !data.mileage_based_price ||
      (Array.isArray(data.mileage_based_price) &&
        data.mileage_based_price.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mileage_based_price"],
        message:
          "mileage_based_price is required when priceMethod is mileage_based",
      });
    }
  }
};

const createCountyZodSchema = z.object({
  body: countyBodyBaseSchema.superRefine(priceMethodRefine),
});

const updateCountyZodSchema = z.object({
  body: countyBodyBaseSchema.partial(),
});

export const CountiesValidation = {
  createCountyZodSchema,
  updateCountyZodSchema,
};
