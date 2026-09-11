import { z } from "zod";
import { checkValidID } from "../../../../shared/checkValidID";

const mileageBasedPriceZodSchema = z.object({
  starting_mileage: z.coerce.number({
    required_error: "Starting mileage is required",
  }),
  first_miles_price: z.coerce.number({
    required_error: "First miles price is required",
  }),
  per_mile_price: z.coerce.number({
    required_error: "Per mile price is required",
  }),
});

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

  if (data.priceMethod === "mileage_based" && data.mileage_based_price == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mileage_based_price"],
      message:
        "mileage_based_price is required when priceMethod is mileage_based",
    });
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
