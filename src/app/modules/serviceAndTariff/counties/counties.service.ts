import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import ApiError from "../../../../errors/ApiErrors";
import { redisService } from "../../../../redis/redis.service";
import { Payers } from "../payers/payers.model";
import { countyPointGeoFilter } from "./counties.geofence.utils";
import {
  geofencesFromLegacyPolygon,
  unionGeometryFromGeofences,
} from "./counties.geofence.utils";
import { ICounty } from "./counties.interface";
import { County } from "./counties.model";
import {
  defaultPriceMethodFromRules,
  zonePricingFromPricingRules,
} from "./counties.pricingRules.utils";
import { getPriceFieldsToUnset } from "./counties.sanitizeByPriceMethod.utils";
import { countyMergedRulesSchema } from "./counties.validation";

const prepareCountyPayload = (payload: Partial<ICounty>): Partial<ICounty> => {
  const next = { ...payload };

  if ((!next.geofences || !next.geofences.length) && next.coversAreasGeoJSON) {
    next.geofences = geofencesFromLegacyPolygon(next.coversAreasGeoJSON);
  }
  if (next.geofences?.length) {
    next.coversAreasGeoJSON = unionGeometryFromGeofences(next.geofences);
  }
  if (next.pricingRules?.length) {
    next.zonePricing = zonePricingFromPricingRules(
      next.pricingRules,
      next.zonePricing,
    );
    if (!next.priceMethod) {
      next.priceMethod = defaultPriceMethodFromRules(next.pricingRules);
    }
  }
  return next;
};

/**
 * Drop every cached county response for this county and its payer(s).
 * List keys are versioned (`:v2`, `:v3`), so all versions are cleared — a missed
 * version keeps serving a stale list for 24h.
 */
const LIST_CACHE_VERSIONS = ["", ":v2", ":v3"];

const clearCountyCaches = async (
  countyId: string,
  payerIds: Array<unknown>,
) => {
  const keys = new Set<string>(["counties", `county:${countyId}`, `counties:${countyId}`]);
  for (const v of LIST_CACHE_VERSIONS) keys.add(`counties:list${v}`);
  for (const raw of payerIds) {
    if (!raw) continue;
    const payerId = String(raw);
    keys.add(`counties:${payerId}`);
    for (const v of LIST_CACHE_VERSIONS) keys.add(`counties:payer:${payerId}${v}`);
  }
  await Promise.all([...keys].map((key) => redisService.del(key)));
};

const createCountiesIntoDB = async (payload: ICounty) => {
  const payer = await Payers.findById(payload.payersId).lean();
  if (!payer) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payer not found");
  }

  const prepared = prepareCountyPayload(payload) as ICounty;
  if (!prepared.geofences?.length && !prepared.coversAreasGeoJSON) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "At least one geofence (JSON upload) is required",
    );
  }

  const result = await County.create(prepared);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create county");
  }

  await clearCountyCaches(result._id.toString(), [result.payersId]);

  await redisService.post({
    key: `county:${result._id.toString()}`,
    value: JSON.stringify(result.toObject()),
    expiration: 24 * 60 * 60,
  });

  return result;
};

/**
 * `?fields=name,isActive` — inclusion-only projection for pickers.
 * County docs carry full geofence geometry, so callers that only need a
 * label must not pull the whole contract.
 */
const parseCountyFields = (fields?: string) =>
  String(fields || "")
    .split(",")
    .map((field) => field.trim())
    .filter((field) => /^[A-Za-z_][\w.]*$/.test(field));

/** `?countyId=<id>` or `<id1>,<id2>` → valid ObjectIds (invalid ids are dropped). */
const countyIdFilter = (countyId?: string) =>
  String(countyId || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

const getAllCountiesFromDB = async (countyId?: string, fields?: string) => {
  const filter: Record<string, unknown> = { isActive: true };
  const ids = countyIdFilter(countyId);
  if (countyId && !ids.length) return [];
  if (ids.length) filter._id = { $in: ids };

  const selected = parseCountyFields(fields);
  if (selected.length) {
    return County.find(filter).select(selected.join(" ")).lean();
  }

  // v3: list cards only need names + fence count — never full geofence geometry.
  // Only the full list is cached; a county-filtered list is read live.
  const cacheKey = ids.length ? null : "counties:list:v3";
  const cachedCounties = cacheKey ? await redisService.get(cacheKey) : null;
  if (cachedCounties) {
    return JSON.parse(cachedCounties);
  }

  const result = await County.find(filter)
    .select(
      "_id name programName organizationType priceMethod isActive fundingSourceId geofences.name",
    )
    .lean();

  if (cacheKey && result.length) {
    await redisService.post({
      key: cacheKey,
      value: JSON.stringify(result),
      expiration: 24 * 60 * 60,
    });
  }

  return result;
};

/** Admin view of one county (active or not), looked up by county id. */
const getAllCountiesForAdmin = async (id: string, fields?: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Valid county id is required");
  }
  const filter = { _id: new Types.ObjectId(id) };
  const selected = parseCountyFields(fields);
  if (selected.length) {
    return County.find(filter).select(selected.join(" ")).lean();
  }
  return County.find(filter).lean();
};

const getSingleCountyFromDB = async (id: string) => {
  const cacheKey = `county:${id}`;
  const cachedCounty = await redisService.get(cacheKey);
  if (cachedCounty) {
    return JSON.parse(cachedCounty);
  }

  const result = await County.findById(id)
    .lean();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await redisService.post({
    key: cacheKey,
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60,
  });

  return result;
};

/** Fields whose change requires re-running the price/date rules. */
const RULE_KEYS = new Set([
  "priceMethod",
  "flat_rate_price",
  "mileage_based_price",
  "mileage_brackets",
  "initial_miles",
  "initial_charge",
  "additional_per_mile",
  "zonePricing",
  "pricingRules",
  "effectiveFrom",
  "effectiveTo",
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Merge `incoming` onto `stored` for plain nested objects (eligibility, programRules, …)
 * so a partial edit keeps sibling fields. Arrays and primitives replace the stored value.
 */
const mergeNested = (stored: unknown, incoming: unknown): unknown => {
  if (!isPlainObject(stored) || !isPlainObject(incoming)) return incoming;
  const result: Record<string, unknown> = { ...stored };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    result[key] = mergeNested(stored[key], value);
  }
  return result;
};

/** Only the keys the client sent, with nested objects merged onto the stored county. */
const buildCountyUpdate = (
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) => {
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    update[key] = mergeNested(existing[key], value);
  }
  return update;
};

const updateCountiesFromDB = async (id: string, payload: Partial<ICounty>) => {
  const existing = await County.findById(id).lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  if (payload.payersId) {
    const payer = await Payers.findById(payload.payersId).lean();
    if (!payer) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Payer not found");
    }
  }

  const stored = existing as unknown as Record<string, unknown>;
  const update = buildCountyUpdate(
    stored,
    prepareCountyPayload(payload) as Record<string, unknown>,
  );

  if (!Object.keys(update).length) {
    return County.findById(id);
  }

  // Switching price method clears the other method's fields.
  const unset = update.priceMethod
    ? getPriceFieldsToUnset(update.priceMethod as ICounty["priceMethod"])
    : {};
  for (const key of Object.keys(update)) delete unset[key];

  // Only re-check price/date rules when this edit touches them, so an old
  // stored value never blocks editing an unrelated field.
  if (Object.keys(update).some((key) => RULE_KEYS.has(key))) {
    const merged: Record<string, unknown> = { ...stored, ...update };
    for (const key of Object.keys(unset)) delete merged[key];
    const check = countyMergedRulesSchema.safeParse(merged);
    if (!check.success) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        check.error.issues.map((issue) => issue.message).join(". "),
      );
    }
  }

  const result = await County.findByIdAndUpdate(
    id,
    Object.keys(unset).length ? { ...update, $unset: unset } : update,
    { new: true, runValidators: true },
  );

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await clearCountyCaches(id, [existing?.payersId, result.payersId]);

  return result;
};

const deleteCountiesFromDB = async (id: string) => {
  const existing = await County.findById(id).select("payersId").lean();

  const result = await County.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await clearCountyCaches(id, [existing?.payersId]);

  return result;
};

const findCountyByLocationFromDB = async (lng: number, lat: number) => {
  if (isNaN(lng) || isNaN(lat)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Invalid longitude or latitude coordinates",
    );
  }

  const result = await County.find({
    isActive: true,
    ...countyPointGeoFilter([lng, lat]),
  })
    .lean();

  return result;
};

const updateCountiesAdminFromDB = async (
  id: string,
  payload: Partial<ICounty>,
) => {
  const existing = await County.findById(id).select("payersId").lean();

  const prepared = prepareCountyPayload(payload);
  const result = await County.findByIdAndUpdate(id, prepared, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await clearCountyCaches(id, [existing?.payersId, result.payersId]);

  return result;
};

export const CountiesService = {
  createCountiesIntoDB,
  getAllCountiesFromDB,
  getSingleCountyFromDB,
  updateCountiesFromDB,
  deleteCountiesFromDB,
  findCountyByLocationFromDB,
  getAllCountiesForAdmin,
  updateCountiesAdminFromDB,
};
