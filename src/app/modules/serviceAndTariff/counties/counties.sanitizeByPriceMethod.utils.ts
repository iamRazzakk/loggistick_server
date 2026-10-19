import { ICounty, IMileageBasedPrice } from "./counties.interface";

export type CountyPriceMethod = ICounty["priceMethod"];

const FLAT_RATE_ONLY = ["flat_rate_price"] as const;
const PER_MILE_ONLY = [
  "starting_fare",
  "first_miles_price",
  "per_mile_price",
] as const;
const MILEAGE_BASED_ONLY = ["mileage_based_price"] as const;

/** All price-related keys that must be cleared when switching method */
const ALL_PRICE_FIELD_KEYS = [
  ...FLAT_RATE_ONLY,
  ...PER_MILE_ONLY,
  ...MILEAGE_BASED_ONLY,
] as const;

const COMMON_KEYS = [
  "payersId",
  "coversAreasGeoJSON",
  "priceMethod",
  "insidePrice",
  "outsidePrice",
  "isActive",
] as const;

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

const parseBandItem = (item: unknown): IMileageBasedPrice | null => {
  if (!item) return null;
  let parsed = item;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const starting_mileage = toNumber(obj.starting_mileage);
  const first_miles_price = toNumber(obj.first_miles_price);
  const per_mile_price = toNumber(obj.per_mile_price);

  if (
    starting_mileage != null &&
    first_miles_price != null &&
    per_mile_price != null &&
    !Number.isNaN(starting_mileage) &&
    !Number.isNaN(first_miles_price) &&
    !Number.isNaN(per_mile_price)
  ) {
    return { starting_mileage, first_miles_price, per_mile_price };
  }
  return null;
};

/**
 * Build mileage_based_price from:
 * 1) already-parsed array of objects / JSON string array
 * 2) already-parsed single object / JSON string object
 * 3) OR flat FormData keys: starting_mileage, first_miles_price, per_mile_price
 *
 * Always returns a sorted array of IMileageBasedPrice[] (or undefined if none valid)
 */
const buildMileageBasedPrice = (
  body: Record<string, unknown>,
): IMileageBasedPrice[] | undefined => {
  let raw = body.mileage_based_price;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = undefined;
    }
  }

  // 1) Array format (e.g. from JSON payload or stringified JSON array in FormData)
  if (Array.isArray(raw)) {
    const bands: IMileageBasedPrice[] = [];
    for (const item of raw) {
      const parsed = parseBandItem(item);
      if (parsed) {
        bands.push(parsed);
      }
    }
    if (bands.length > 0) {
      // Sort ascending by starting_mileage for consistency
      return bands.sort((a, b) => a.starting_mileage - b.starting_mileage);
    }
  }

  // 2) Single object format
  const single = parseBandItem(raw);
  if (single) {
    return [single];
  }

  // 3) Flat FormData fallback (frontend sends separate keys, no nested object)
  const starting_mileage = toNumber(body.starting_mileage);
  const first_miles_price = toNumber(body.first_miles_price);
  const per_mile_price = toNumber(body.per_mile_price);

  if (
    starting_mileage != null &&
    first_miles_price != null &&
    per_mile_price != null
  ) {
    return [{ starting_mileage, first_miles_price, per_mile_price }];
  }

  return undefined;
};

const pickDefined = (
  body: Record<string, unknown>,
  keys: readonly string[],
) => {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) {
      result[key] = body[key];
    }
  }
  return result;
};

/**
 * Keep only fields allowed for the given priceMethod.
 * Extra / wrong-method fields are dropped so frontend can send a full form safely.
 */
export const sanitizeCountyPayloadByPriceMethod = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const priceMethod = body.priceMethod as CountyPriceMethod | undefined;

  // No method yet (partial update) — only strip empty helpers, do not force shape
  if (!priceMethod) {
    const cleaned = { ...body };
    delete cleaned.starting_mileage;
    delete cleaned.first_miles_price;
    delete cleaned.per_mile_price;
    delete cleaned.data;

    if (cleaned.mileage_based_price !== undefined) {
      const mileage = buildMileageBasedPrice(body);
      if (mileage) {
        cleaned.mileage_based_price = mileage;
      }
    }

    return cleaned;
  }

  const common = pickDefined(body, COMMON_KEYS as unknown as string[]);
  const sanitized: Record<string, unknown> = { ...common, priceMethod };

  if (priceMethod === "flat_rate") {
    Object.assign(sanitized, pickDefined(body, FLAT_RATE_ONLY as unknown as string[]));
    return sanitized;
  }

  if (priceMethod === "per_mile") {
    Object.assign(sanitized, pickDefined(body, PER_MILE_ONLY as unknown as string[]));
    return sanitized;
  }

  // mileage_based
  const mileage = buildMileageBasedPrice(body);
  if (mileage) {
    sanitized.mileage_based_price = mileage;
  }

  return sanitized;
};

/**
 * When priceMethod changes on update, Mongo should $unset other method fields.
 */
export const getPriceFieldsToUnset = (
  priceMethod: CountyPriceMethod,
): Record<string, 1> => {
  const keep =
    priceMethod === "flat_rate"
      ? new Set(FLAT_RATE_ONLY)
      : priceMethod === "per_mile"
        ? new Set(PER_MILE_ONLY)
        : new Set(MILEAGE_BASED_ONLY);

  const unset: Record<string, 1> = {};
  for (const key of ALL_PRICE_FIELD_KEYS) {
    if (!keep.has(key as never)) {
      unset[key] = 1;
    }
  }
  return unset;
};
