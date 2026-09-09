import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { redisService } from "../../../../redis/redis.service";
import { IPayers } from "./payers.interface";
import { Payers } from "./payers.model";
import {
  PAYERS_ADMIN_CACHE_KEY,
  PAYERS_CACHE_KEY,
} from "./payers.constants";

const invalidatePayersCache = async () => {
  await redisService.del(PAYERS_CACHE_KEY);
  await redisService.del(PAYERS_ADMIN_CACHE_KEY);
};

const createPayersIntoDB = async (payload: IPayers) => {
  const result = await Payers.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create payer");
  }
  await invalidatePayersCache();
  return result;
};

const getAllPayersFromDB = async () => {
  const cachedPayers = await redisService.get(PAYERS_CACHE_KEY);
  if (cachedPayers) {
    return JSON.parse(cachedPayers);
  }

  const result = await Payers.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get payers");
  }

  await redisService.post({
    key: PAYERS_CACHE_KEY,
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });

  return result;
};

const getAllPayersForAdminFromDB = async () => {
  const cachedPayers = await redisService.get(PAYERS_ADMIN_CACHE_KEY);
  if (cachedPayers) {
    return JSON.parse(cachedPayers);
  }

  const result = await Payers.find().lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get payers");
  }

  await redisService.post({
    key: PAYERS_ADMIN_CACHE_KEY,
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60,
  });

  return result;
};

const getSinglePayersFromDB = async (id: string) => {
  const result = await Payers.findById(id).lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payer not found");
  }
  return result;
};

const updatePayersFromDB = async (id: string, payload: Partial<IPayers>) => {
  const result = await Payers.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payer not found");
  }
  await invalidatePayersCache();
  return result;
};

const deletePayersFromDB = async (id: string) => {
  const result = await Payers.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true },
  );
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Payer not found");
  }
  await invalidatePayersCache();
  return result;
};

export const PayersServices = {
  createPayersIntoDB,
  getAllPayersFromDB,
  getAllPayersForAdminFromDB,
  getSinglePayersFromDB,
  updatePayersFromDB,
  deletePayersFromDB,
};
