import { IMobility } from "./mobility.interface";
import { Mobility } from "./mobility.model";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../../errors/ApiErrors";
import { redisService } from "../../../../redis/redis.service";
import { JwtPayload } from "jsonwebtoken";

const createMobilityIntoDB = async (payload: IMobility, user: JwtPayload) => {
  payload.creator = user?.id;
  const result = await Mobility.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create mobility");
  }
  await redisService.del("mobility");
  return result;
};

const getAllMobilityFromDB = async () => {
  const cachedMobility = await redisService.get("mobility");
  if (cachedMobility) {
    console.log("==========>>>From cache");
    return JSON.parse(cachedMobility);
  }
  const result = await Mobility.find({ status: true }).lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get mobility");
  }
  await redisService.post({
    key: "mobility",
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });
  return result;
};

const getSingleMobilityFromDB = async (id: string) => {
  const result = await Mobility.findById(id);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get mobility");
  }
  return result;
};

const updateMobilityFromDB = async (
  id: string,
  payload: Partial<IMobility>,
) => {
  const result = await Mobility.findByIdAndUpdate(id, payload, { new: true });
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to update mobility");
  }
  await redisService.del("mobility");
  return result;
};

const deleteMobilityFromDB = async (id: string, user: JwtPayload) => {
  const result = await Mobility.findByIdAndUpdate(
    id,
    {
      deletedUser: user?.id,
      status: false,
    },
    { new: true },
  );
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to delete mobility");
  }
  await redisService.del("mobility");
  return result;
};

export const MobilityServices = {
  createMobilityIntoDB,
  getAllMobilityFromDB,
  getSingleMobilityFromDB,
  updateMobilityFromDB,
  deleteMobilityFromDB,
};
