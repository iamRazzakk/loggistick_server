import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { IVehicle } from "./vehicle.interface";
import { Vehicle } from "./vehicle.model";
import { redisService } from "../../../redis/redis.service";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const caseInsensitive = (value: string) => ({
  $regex: escapeRegex(value),
  $options: "i",
});

const createVehicleIntoDB = async (payload: IVehicle) => {
  const result = await Vehicle.create(payload);
  await redisService.del("vehicles");
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create vehicle");
  }
  return result;
};

const readQueryString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getAllVehiclesFromDB = async (query: Record<string, unknown> = {}) => {
  const vData = await redisService.get("vehicles");
  let result: IVehicle[];
  if (vData) {
    console.log("from redis.....");
    result = JSON.parse(vData as string);
  } else {
    console.log("catch missing vehicle data...");
    result = await Vehicle.find().lean();
    if (!result) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get vehicles");
    }
    await redisService.post({
      key: "vehicles",
      value: JSON.stringify(result),
      expiration: 60 * 60 * 24, // 24 hours
    });
  }

  const searchTerm = readQueryString(query.searchTerm).toLowerCase();
  const manufacturer = readQueryString(query.manufacturer).toLowerCase();
  const model = readQueryString(query.model).toLowerCase();
  const year = readQueryString(query.year);

  if (!searchTerm && !manufacturer && !model && !year) {
    return result;
  }

  return result.filter((vehicle) => {
    if (
      manufacturer &&
      !vehicle.manufacturer?.toLowerCase().includes(manufacturer)
    ) {
      return false;
    }
    if (model && !vehicle.model?.toLowerCase().includes(model)) {
      return false;
    }
    if (year && String(vehicle.year) !== year) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }

    return (
      vehicle.manufacturer?.toLowerCase().includes(searchTerm) ||
      vehicle.model?.toLowerCase().includes(searchTerm) ||
      String(vehicle.year).includes(searchTerm)
    );
  });
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
