import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { redisService } from "../../../../redis/redis.service";
import { Payers } from "../payers/payers.model";
import { ICounty } from "./counties.interface";
import { County } from "./counties.model";
import { getPriceFieldsToUnset } from "./counties.sanitizeByPriceMethod.utils";

const COUNTIES_CACHE_KEY = "counties";
const COUNTIES_ADMIN_CACHE_KEY = "counties-for-admin";

const invalidateCountiesCache = async () => {
  await redisService.del(COUNTIES_CACHE_KEY);
  await redisService.del(COUNTIES_ADMIN_CACHE_KEY);
};

const createCountiesIntoDB = async (payload: ICounty) => {
  const payer = await Payers.findById(payload.payersId).lean();
  if (!payer) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payer not found");
  }

  const result = await County.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create county");
  }

  await invalidateCountiesCache();
  return result;
};

const getAllCountiesFromDB = async (payersId?: string) => {
  const cacheKey = payersId
    ? `${COUNTIES_CACHE_KEY}:${payersId}`
    : COUNTIES_CACHE_KEY;

  const cachedCounties = await redisService.get(cacheKey);
  if (cachedCounties) {
    return JSON.parse(cachedCounties);
  }

  const filter: Record<string, unknown> = { isActive: true };
  if (payersId) {
    filter.payersId = payersId;
  }

  const result = await County.find(filter)
    .populate("payersId", "name type isActive")
    .lean();

  await redisService.post({
    key: cacheKey,
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60,
  });

  return result;
};

const getAllCountiesForAdmin = async (payersId?: string) => {
  const cacheKey = payersId
    ? `${COUNTIES_ADMIN_CACHE_KEY}:${payersId}`
    : COUNTIES_ADMIN_CACHE_KEY;

  const cachedCounties = await redisService.get(cacheKey);
  if (cachedCounties) {
    return JSON.parse(cachedCounties);
  }

  const filter: Record<string, unknown> = {};
  if (payersId) {
    filter.payersId = payersId;
  }

  const result = await County.find(filter)
    .populate("payersId", "name type isActive")
    .lean();

  await redisService.post({
    key: cacheKey,
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60,
  });

  return result;
};

const getSingleCountyFromDB = async (id: string) => {
  const result = await County.findById(id)
    .populate("payersId", "name type isActive")
    .lean();

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  return result;
};

const updateCountiesFromDB = async (id: string, payload: Partial<ICounty>) => {
  if (payload.payersId) {
    const payer = await Payers.findById(payload.payersId).lean();
    if (!payer) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Payer not found");
    }
  }

  const updateQuery: Record<string, unknown> = { $set: payload };

  // When method changes, clear other method's price fields from DB
  if (payload.priceMethod) {
    updateQuery.$unset = getPriceFieldsToUnset(payload.priceMethod);
  }

  const result = await County.findByIdAndUpdate(id, updateQuery, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await invalidateCountiesCache();
  return result;
};

const deleteCountiesFromDB = async (id: string) => {
  const result = await County.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "County not found");
  }

  await invalidateCountiesCache();
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
    coversAreasGeoJSON: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
    },
  })
    .populate("payersId", "name type isActive")
    .lean();

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
};
