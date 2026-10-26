import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";

export type PriceMethod =
  | "flat_rate"
  | "per_mile"
  | "mileage_based"
  | "first_x_miles";

export type ZoneName = "inside" | "outside";

export type MileageSource = "calculated_route" | "actual_gps" | "straight_line";

export type MileageRounding = "none" | "nearest" | "up" | "down";

export type ChargeOutcome =
  | "none"
  | "passenger_only"
  | "funding_source_only"
  | "both";

export type MileageBracket = {
  min_mileage: number;
  max_mileage?: number | null;
  charge: number;
};

export type LegacyMileageBand = {
  starting_mileage: number;
  first_miles_price: number;
  per_mile_price?: number;
};

export type RateCard = {
  priceMethod: PriceMethod;
  flat_rate_price?: number;
  base_rate?: number;
  per_mile_rate?: number;
  mileage_brackets?: MileageBracket[];
  initial_miles?: number;
  initial_charge?: number;
  additional_per_mile?: number;
  passenger_copay?: number;
  classRates?: Array<RateCard & { billingClass: string }>;
};

export type PricedLeg = {
  leg: "outbound" | "return";
  zone: ZoneName;
  billingClass?: string;
  priceMethod: PriceMethod;
  straightLineMileage: number;
  calculatedRouteMileage: number | null;
  billingMileage: number;
  billingMileageSource: string;
  fundingSourceCharge: number;
  passengerCoPay: number;
};

export const toMoney = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Trip price could not be calculated",
    );
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const classifyZone = (
  pickupInside: boolean,
  dropoffInside: boolean,
): ZoneName => (pickupInside && dropoffInside ? "inside" : "outside");

export const isCountyEffective = (
  county: { effectiveFrom?: string | null; effectiveTo?: string | null },
  serviceDay: string,
) => {
  if (county.effectiveFrom && county.effectiveFrom > serviceDay) return false;
  if (county.effectiveTo && county.effectiveTo < serviceDay) return false;
  return true;
};

export const roundMileage = (
  miles: number,
  mode: MileageRounding = "none",
  precision = 2,
) => {
  if (!Number.isFinite(miles) || miles < 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Billing mileage must be a zero or positive number",
    );
  }
  if (mode === "none") return miles;
  const places = Number.isFinite(precision) ? Math.max(0, Math.trunc(precision)) : 2;
  const factor = 10 ** places;
  const scaled = miles * factor;
  if (mode === "up") return Math.ceil(scaled - 1e-10) / factor;
  if (mode === "down") return Math.floor(scaled + 1e-10) / factor;
  return Math.round(scaled) / factor;
};

export const bracketError = (brackets: MileageBracket[]): string | null => {
  if (!brackets.length) return "At least one mileage bracket is required";
  const sorted = [...brackets].sort((a, b) => a.min_mileage - b.min_mileage);
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    if (!Number.isFinite(band.min_mileage) || band.min_mileage < 0) {
      return "Mileage bracket min_mileage must be zero or greater";
    }
    if (!Number.isFinite(band.charge) || band.charge < 0) {
      return "Mileage bracket charge must be zero or greater";
    }
    const open = band.max_mileage == null;
    if (!open && (!Number.isFinite(band.max_mileage) || (band.max_mileage as number) <= band.min_mileage)) {
      return "Mileage bracket max_mileage must be greater than min_mileage";
    }
    if (i > 0) {
      const previous = sorted[i - 1];
      if (previous.max_mileage == null) {
        return "Only the last mileage bracket can be open-ended";
      }
      if (band.min_mileage < previous.max_mileage) {
        return "Mileage brackets overlap";
      }
      if (band.min_mileage > previous.max_mileage) {
        return "Mileage brackets leave a gap";
      }
    }
  }
  return null;
};

/**
 * Exact max of a bracket belongs to that bracket.
 * The next bracket starts above that max (`miles > min` after the first).
 */
export const priceMileageBrackets = (brackets: MileageBracket[], miles: number) => {
  const problem = bracketError(brackets);
  if (problem) {
    throw new ApiError(StatusCodes.BAD_REQUEST, problem);
  }
  const sorted = [...brackets].sort((a, b) => a.min_mileage - b.min_mileage);
  for (let i = 0; i < sorted.length; i += 1) {
    const band = sorted[i];
    const starts = i === 0 ? miles >= band.min_mileage : miles > band.min_mileage;
    const ends = band.max_mileage == null || miles <= band.max_mileage;
    if (starts && ends) return band.charge;
  }
  throw new ApiError(
    StatusCodes.BAD_REQUEST,
    "No mileage bracket covers this trip distance",
  );
};

export const legacyBandsToBrackets = (
  bands: LegacyMileageBand[] | LegacyMileageBand | undefined,
): MileageBracket[] => {
  if (!bands) return [];
  const rows = (Array.isArray(bands) ? bands : [bands]).filter(
    (band) =>
      Number.isFinite(band?.starting_mileage) &&
      Number.isFinite(band?.first_miles_price),
  );
  const sorted = [...rows].sort((a, b) => a.starting_mileage - b.starting_mileage);
  let min = 0;
  return sorted.map((band) => {
    const bracket = {
      min_mileage: min,
      max_mileage: band.starting_mileage,
      charge: band.first_miles_price,
    };
    min = band.starting_mileage;
    return bracket;
  });
};

export const priceFundingSourceCharge = (
  card: RateCard,
  rawMiles: number,
  rounding: MileageRounding = "none",
  precision = 2,
) => {
  const miles = roundMileage(rawMiles, rounding, precision);
  if (card.priceMethod === "flat_rate") {
    if (card.flat_rate_price == null || !Number.isFinite(card.flat_rate_price)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Flat rate price is not configured for this zone",
      );
    }
    return { charge: toMoney(card.flat_rate_price), billingMileage: miles };
  }

  if (card.priceMethod === "per_mile") {
    const base = card.base_rate ?? 0;
    const rate = card.per_mile_rate ?? 0;
    return { charge: toMoney(base + miles * rate), billingMileage: miles };
  }

  if (card.priceMethod === "first_x_miles") {
    const included = card.initial_miles ?? 0;
    const initialCharge = card.initial_charge ?? 0;
    const additional = card.additional_per_mile ?? 0;
    const extra = Math.max(0, miles - included);
    return {
      charge: toMoney(initialCharge + extra * additional),
      billingMileage: miles,
    };
  }

  const charge = priceMileageBrackets(card.mileage_brackets ?? [], miles);
  return { charge: toMoney(charge), billingMileage: miles };
};

export const selectBillingMileage = (input: {
  source: MileageSource;
  calculatedRouteMileage: number | null;
  actualGpsMileage: number | null;
  straightLineMileage: number;
}) => {
  if (
    input.source === "actual_gps" &&
    input.actualGpsMileage != null &&
    Number.isFinite(input.actualGpsMileage) &&
    input.actualGpsMileage >= 0
  ) {
    return {
      billingMileage: input.actualGpsMileage,
      billingMileageSource: "actual_gps" as const,
    };
  }
  if (
    input.source === "calculated_route" &&
    input.calculatedRouteMileage != null &&
    Number.isFinite(input.calculatedRouteMileage)
  ) {
    return {
      billingMileage: input.calculatedRouteMileage,
      billingMileageSource: "calculated_route" as const,
    };
  }
  if (input.source === "straight_line") {
    return {
      billingMileage: input.straightLineMileage,
      billingMileageSource: "straight_line" as const,
    };
  }
  return {
    billingMileage: input.straightLineMileage,
    billingMileageSource: "straight_line_fallback" as const,
  };
};

export const applyChargeOutcome = (
  fundingSourceCharge: number,
  passengerCopay: number,
  outcome: ChargeOutcome,
) => {
  if (outcome === "none") {
    return { fundingSourceCharge: 0, passengerCopay: 0 };
  }
  if (outcome === "passenger_only") {
    return { fundingSourceCharge: 0, passengerCopay };
  }
  if (outcome === "funding_source_only") {
    return { fundingSourceCharge, passengerCopay: 0 };
  }
  return { fundingSourceCharge, passengerCopay };
};
