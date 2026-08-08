import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IVehicle } from "./vehicle.interface";
import { Vehicle } from "./vehicle.model";
import { redisService } from "../../../redis/redis.service";

const createVehicleIntoDB = async (payload: IVehicle) => {
  const result = await Vehicle.create(payload);
  await redisService.del("vehicles");
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create vehicle");
  }
  return result;
};

const getAllVehiclesFromDB = async () => {
  const vData = await redisService.get("vehicles");
  if (vData) {
    console.log("from redis.....");
    return JSON.parse(vData as string);
  }
  console.log("catch missing vehicle data...");
  const result = await Vehicle.find().lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get vehicles");
  }
  await redisService.post({
    key: "vehicles",
    value: JSON.stringify(result),
    expiration: 60 * 60 * 24, // 24 hours
  });
  return result;
};

const getSingleVehicleFromDB = async (id: string) => {
  const data = await Vehicle.findById(id).lean();
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Vehicle not found");
  }
  return data;
};

const updateVehicleInDB = async (id: string, payload: IVehicle) => {
  const data = await Vehicle.findByIdAndUpdate(id, payload, {
    new: true,
  }).lean();
  await redisService.del("vehicles");
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Vehicle not found");
  }
  return data;
};

const deleteVehicleFromDB = async (id: string) => {
  const data = await Vehicle.findByIdAndDelete(id).lean();
  await redisService.del("vehicles");
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Vehicle not found");
  }
  return data;
};

export const VehicleServices = {
  createVehicleIntoDB,
  getAllVehiclesFromDB,
  getSingleVehicleFromDB,
  updateVehicleInDB,
  deleteVehicleFromDB,
};
