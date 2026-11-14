import { PriceMethod, RateCard } from "../../booking/pricing/tripPricing";
import {
  IPricingRule,
  IZonePricing,
  PricingArea,
} from "./counties.interface";

const toPriceMethod = (method: IPricingRule["method"]): PriceMethod => {
  if (method === "base_plus_additional_mileage") return "first_x_miles";
  if (method === "mileage_brackets") return "mileage_based";
  if (
    method === "flat_rate" ||
    method === "per_mile" ||
    method === "mileage_based" ||
    method === "first_x_miles"
  ) {
    return method;
  }
  return "flat_rate";
};

const ruleToRateCard = (rule: IPricingRule): RateCard & { billingClass: string } => {
  const priceMethod = toPriceMethod(rule.method);
  const card: RateCard & { billingClass: string } = {
    billingClass: rule.billingClass,
    priceMethod,
  };

  if (priceMethod === "flat_rate") {
    card.flat_rate_price = rule.flatRate ?? 0;
  } else if (priceMethod === "first_x_miles") {
    card.initial_miles = rule.includedMiles ?? 0;
    card.initial_charge = rule.baseRate ?? 0;
    card.additional_per_mile = rule.additionalMileRate ?? 0;
  } else if (priceMethod === "mileage_based") {
    card.mileage_brackets = (rule.brackets ?? []).map((band) => ({
      min_mileage: band.from,
      max_mileage: band.to ?? null,
      charge: band.amount,
    }));
  } else if (priceMethod === "per_mile") {
    card.base_rate = rule.baseRate ?? 0;
    card.per_mile_rate = rule.additionalMileRate ?? 0;
  }

  return card;
};

const zonesForArea = (area: PricingArea): Array<"inside" | "outside"> => {
  if (area === "both") return ["inside", "outside"];
  return [area];
};

/** Copy rate fields onto the zone card so Zod refine (flat_rate_price required) passes. */
const withZoneRateDefaults = (
  zoneCard: RateCard & { classRates?: Array<RateCard & { billingClass: string }> },
  fromClass: RateCard,
): RateCard & { classRates?: Array<RateCard & { billingClass: string }> } => {
  const priceMethod = zoneCard.priceMethod ?? fromClass.priceMethod;
  const next: RateCard & { classRates?: Array<RateCard & { billingClass: string }> } = {
    ...zoneCard,
    priceMethod,
  };

  if (priceMethod === "flat_rate" && next.flat_rate_price == null) {
    next.flat_rate_price = fromClass.flat_rate_price ?? 0;
  }
  if (priceMethod === "first_x_miles") {
    if (next.initial_miles == null) next.initial_miles = fromClass.initial_miles ?? 0;
    if (next.initial_charge == null) next.initial_charge = fromClass.initial_charge ?? 0;
    if (next.additional_per_mile == null) {
      next.additional_per_mile = fromClass.additional_per_mile ?? 0;
    }
  }
  if (priceMethod === "mileage_based" && !next.mileage_brackets?.length) {
    next.mileage_brackets = fromClass.mileage_brackets;
  }
  if (priceMethod === "per_mile") {
    if (next.base_rate == null) next.base_rate = fromClass.base_rate ?? 0;
    if (next.per_mile_rate == null) next.per_mile_rate = fromClass.per_mile_rate ?? 0;
  }

  return next;
};

/**
 * Map contract pricingRules[] into zonePricing.classRates so getTripPrice
 * keeps working without rewriting the fare engine.
 */
export const zonePricingFromPricingRules = (
  rules: IPricingRule[] | undefined,
  existing?: IZonePricing,
): IZonePricing | undefined => {
  if (!rules?.length) return existing;

  const zonePricing: IZonePricing = {
    inside: existing?.inside ? { ...existing.inside } : undefined,
    outside: existing?.outside ? { ...existing.outside } : undefined,
  };

  for (const rule of rules) {
    const card = ruleToRateCard(rule);
    for (const zone of zonesForArea(rule.area ?? "both")) {
      const current = zonePricing[zone] ?? {
        priceMethod: card.priceMethod,
      };
      const classRates = [...(current.classRates ?? [])].filter(
        (row) => row.billingClass !== card.billingClass,
      );
      classRates.push(card);
      zonePricing[zone] = withZoneRateDefaults(
        {
          ...current,
          priceMethod: current.priceMethod ?? card.priceMethod,
          classRates,
        },
        card,
      );
    }
  }

  return zonePricing;
};

/** Default county-level priceMethod from first pricing rule. */
export const defaultPriceMethodFromRules = (
  rules: IPricingRule[] | undefined,
  fallback?: PriceMethod,
): PriceMethod | undefined => {
  if (!rules?.length) return fallback;
  return toPriceMethod(rules[0].method);
};
