import { z } from "zod";
import { checkValidID } from "../../../../shared/checkValidID";
import { bracketError } from "../../booking/pricing/tripPricing";

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

const mileageBracketSchema = z.object({
  min_mileage: z.coerce.number().min(0, "min_mileage must be 0 or greater"),
  max_mileage: z.coerce.number().min(0).nullable().optional(),
  charge: z.coerce.number().min(0, "Bracket charge must be 0 or greater"),
});

const CHARGE_OUTCOMES = [
  "none",
  "passenger_only",
  "funding_source_only",
  "both",
] as const;

const PRICE_METHODS = [
  "flat_rate",
  "per_mile",
  "mileage_based",
  "first_x_miles",
] as const;

const rateCardFields = {
  priceMethod: z.enum(PRICE_METHODS),
  flat_rate_price: z.coerce.number().min(0).optional(),
  base_rate: z.coerce.number().min(0).optional(),
  per_mile_rate: z.coerce.number().min(0).optional(),
  mileage_brackets: z.array(mileageBracketSchema).optional(),
  initial_miles: z.coerce.number().min(0).optional(),
  initial_charge: z.coerce.number().min(0).optional(),
  additional_per_mile: z.coerce.number().min(0).optional(),
  passenger_copay: z.coerce.number().min(0).optional(),
};

const classRateSchema = z.object({
  billingClass: z.string().min(1, "Billing class is required"),
  ...rateCardFields,
});

const zoneRateCardSchema = z.object({
  ...rateCardFields,
  classRates: z.array(classRateSchema).optional(),
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

  priceMethod: z.enum(PRICE_METHODS, {
    required_error: "Price method is required",
  }),

  flat_rate_price: z.coerce.number().min(0).optional(),
  starting_fare: z.coerce.number().min(0).optional(),
  first_miles_price: z.coerce.number().min(0).optional(),
  per_mile_price: z.coerce.number().min(0).optional(),
  base_rate: z.coerce.number().min(0).optional(),
  per_mile_rate: z.coerce.number().min(0).optional(),
  mileage_based_price: mileageBasedPriceZodSchema.optional(),
  mileage_brackets: z.array(mileageBracketSchema).optional(),
  initial_miles: z.coerce.number().min(0).optional(),
  initial_charge: z.coerce.number().min(0).optional(),
  additional_per_mile: z.coerce.number().min(0).optional(),

  insidePrice: z.coerce.number().optional(),
  outsidePrice: z.coerce.number().optional(),
  zonePricing: z
    .object({
      inside: zoneRateCardSchema.optional(),
      outside: zoneRateCardSchema.optional(),
    })
    .optional(),
  passengerCopayInside: z.coerce.number().min(0).optional(),
  passengerCopayOutside: z.coerce.number().min(0).optional(),
  mileageSource: z
    .enum(["calculated_route", "actual_gps", "straight_line"])
    .optional(),
  mileageRounding: z.enum(["none", "nearest", "up", "down"]).optional(),
  mileagePrecision: z.coerce.number().int().min(0).max(6).optional(),
  mobilityBillingMap: z
    .array(
      z.object({
        mobilityId: checkValidID("Valid mobilityId is required"),
        billingClass: z.string().min(1, "Billing class is required"),
      }),
    )
    .optional(),
  chargeRules: z
    .object({
      cancellation: z.enum(CHARGE_OUTCOMES).optional(),
      noShow: z.enum(CHARGE_OUTCOMES).optional(),
    })
    .optional(),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveFrom must be YYYY-MM-DD")
    .nullable()
    .optional(),
  effectiveTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveTo must be YYYY-MM-DD")
    .nullable()
    .optional(),
  // boolean already coerced in parseCountyUpload (FormData)
  isActive: z.boolean().optional().default(true),
});

const addRateCardIssues = (
  card: {
    priceMethod?: (typeof PRICE_METHODS)[number];
    flat_rate_price?: number;
    mileage_brackets?: z.infer<typeof mileageBracketSchema>[];
    mileage_based_price?: unknown;
    initial_miles?: number;
    initial_charge?: number;
    additional_per_mile?: number;
  },
  ctx: z.RefinementCtx,
  path: (string | number)[],
) => {
  if (!card.priceMethod) return;
  if (card.priceMethod === "flat_rate" && card.flat_rate_price == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, "flat_rate_price"],
      message: "flat_rate_price is required when priceMethod is flat_rate",
    });
  }
  if (card.priceMethod === "mileage_based") {
    const brackets = card.mileage_brackets;
    const legacy = card.mileage_based_price;
    const hasLegacy = Array.isArray(legacy) ? legacy.length > 0 : legacy != null;
    if ((!brackets || brackets.length === 0) && !hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, "mileage_brackets"],
        message: "mileage_brackets or mileage_based_price is required",
      });
    }
    if (brackets?.length) {
      const problem = bracketError(brackets);
      if (problem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, "mileage_brackets"],
          message: problem,
        });
      }
    }
  }
  if (card.priceMethod === "first_x_miles") {
    if (card.initial_miles == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, "initial_miles"],
        message: "initial_miles is required when priceMethod is first_x_miles",
      });
    }
    if (card.initial_charge == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, "initial_charge"],
        message: "initial_charge is required when priceMethod is first_x_miles",
      });
    }
    if (card.additional_per_mile == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, "additional_per_mile"],
        message:
          "additional_per_mile is required when priceMethod is first_x_miles",
      });
    }
  }
};

const priceMethodRefine = (
  data: z.infer<typeof countyBodyBaseSchema>,
  ctx: z.RefinementCtx,
) => {
  addRateCardIssues(data, ctx, []);
  if (data.mileage_brackets?.length) {
    const problem = bracketError(data.mileage_brackets);
    if (problem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mileage_brackets"],
        message: problem,
      });
    }
  }
  for (const zone of ["inside", "outside"] as const) {
    const card = data.zonePricing?.[zone];
    if (!card) continue;
    addRateCardIssues(card, ctx, ["zonePricing", zone]);
    card.classRates?.forEach((classCard, index) => {
      addRateCardIssues(classCard, ctx, [
        "zonePricing",
        zone,
        "classRates",
        index,
      ]);
    });
  }
  if (
    data.effectiveFrom &&
    data.effectiveTo &&
    data.effectiveFrom > data.effectiveTo
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveTo"],
      message: "effectiveTo must be on or after effectiveFrom",
    });
  }
};

const createCountyZodSchema = z.object({
  body: countyBodyBaseSchema.superRefine(priceMethodRefine),
});

const updateCountyZodSchema = z.object({
  body: countyBodyBaseSchema.partial().superRefine((data, ctx) => {
    if (data.priceMethod || data.zonePricing || data.mileage_brackets) {
      priceMethodRefine(data as z.infer<typeof countyBodyBaseSchema>, ctx);
    }
  }),
});

export const CountiesValidation = {
  createCountyZodSchema,
  updateCountyZodSchema,
};
