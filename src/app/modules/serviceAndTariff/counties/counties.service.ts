import { StatusCodes } from "http-status-codes";
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

  await redisService.del("counties");
  await redisService.del("counties:list");
  await redisService.del("counties:list:v2");
  await redisService.del(`counties:payer:${result.payersId.toString()}`);
  await redisService.del(`counties:payer:${result.payersId.toString()}:v2`);
  await redisService.del(`counties:${result._id.toString()}`);

  await redisService.post({
    key: `county:${result._id.toString()}`,
    value: JSON.stringify(result.toObject()),
    expiration: 24 * 60 * 60,
  });

  return result;
};

const getAllCountiesFromDB = async (payersId?: string) => {
  // v2: include contract `name` (Funding Source name) for admin list UI
  const cacheKey = payersId
    ? `counties:payer:${payersId}:v2`
    : "counties:list:v2";
  const cachedCounties = await redisService.get(cacheKey);
  if (cachedCounties) {
    return JSON.parse(cachedCounties);
  }

  const filter: Record<string, unknown> = { isActive: true };
  if (payersId) {
    filter.payersId = payersId;
  }

  const result = await County.find(filter)
    .select(
      "_id name programName organizationType priceMethod isActive geofences fundingSourceId",
    )
    .lean();

  if (result.length) {
    await redisService.post({
      key: cacheKey,
      value: JSON.stringify(result),
      expiration: 24 * 60 * 60,
    });
  }

  return result;
};

const getAllCountiesForAdmin = async (id: string) => {
  const result = await County.find({ payersId: id })
    .populate("payersId", "name type isActive")
    .lean();
  return result;
};

const getSingleCountyFromDB = async (id: string) => {
  const cacheKey = `county:${id}`;
  const cachedCounty = await redisService.get(cacheKey);
  if (cachedCounty) {
    return JSON.parse(cachedCounty);
  }

  const result = await County.findById(id)
    .populate("payersId", "name type isActive")
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

const updateCountiesFromDB = async (id: string, payload: Partial<ICounty>) => {
  const existing = await County.findById(id).select("payersId").lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  if (payload.payersId) {
    const payer = await Payers.findById(payload.payersId).lean();
    if (!payer) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Payer not found");
    }
  }

  const prepared = prepareCountyPayload(payload);
  const updateQuery: Record<string, unknown> = { $set: prepared };

  if (prepared.priceMethod) {
    updateQuery.$unset = getPriceFieldsToUnset(prepared.priceMethod);
  }

  const result = await County.findByIdAndUpdate(id, updateQuery, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await redisService.del("counties");
  await redisService.del("counties:list");
  await redisService.del("counties:list:v2");
  await redisService.del(`county:${id}`);
  await redisService.del(`counties:${id}`);
  await redisService.del(`counties:payer:${existing.payersId.toString()}`);
  await redisService.del(`counties:payer:${existing.payersId.toString()}:v2`);
  await redisService.del(`counties:${existing.payersId.toString()}`);
  await redisService.del(`counties:payer:${result.payersId.toString()}`);
  await redisService.del(`counties:payer:${result.payersId.toString()}:v2`);

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

  await redisService.del("counties");
  await redisService.del("counties:list");
  await redisService.del("counties:list:v2");
  await redisService.del(`county:${id}`);
  await redisService.del(`counties:${id}`);
  if (existing?.payersId) {
    await redisService.del(`counties:payer:${existing.payersId.toString()}`);
    await redisService.del(`counties:payer:${existing.payersId.toString()}:v2`);
    await redisService.del(`counties:${existing.payersId.toString()}`);
  }

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
    .populate("payersId", "name type isActive")
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

  await redisService.del("counties");
  await redisService.del("counties:list");
  await redisService.del("counties:list:v2");
  await redisService.del(`county:${id}`);
  await redisService.del(`counties:${id}`);
  if (existing?.payersId) {
    await redisService.del(`counties:payer:${existing.payersId.toString()}`);
    await redisService.del(`counties:payer:${existing.payersId.toString()}:v2`);
    await redisService.del(`counties:${existing.payersId.toString()}`);
  }
  await redisService.del(`counties:payer:${result.payersId.toString()}`);
  await redisService.del(`counties:payer:${result.payersId.toString()}:v2`);

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
