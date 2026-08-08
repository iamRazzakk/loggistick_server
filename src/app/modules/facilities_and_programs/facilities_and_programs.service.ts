import ApiError from "../../../errors/ApiErrors";
import { redisService } from "../../../redis/redis.service";
import { IFacilitiesAndPrograms } from "./facilities_and_programs.interface";
import { FacilitiesAndPrograms } from "./facilities_and_programs.model";

const createFacilitiesAndProgramsIntoDB = async (
  payload: IFacilitiesAndPrograms,
): Promise<IFacilitiesAndPrograms> => {
  const result = await FacilitiesAndPrograms.create(payload);
  await redisService.del("facilitiesAndPrograms");
  if (!result) {
    throw new ApiError(400, "Failed to create facilities and programs");
  }
  return result;
};

const getAllFacilitiesAndProgramsFromDB = async (): Promise<
  IFacilitiesAndPrograms[]
> => {
  //
  const cachedData = await redisService.get("facilitiesAndPrograms");
  if (cachedData) {
    console.log(":::::::::::::From Cache");
    return JSON.parse(cachedData);
  }
  const result = await FacilitiesAndPrograms.find({ isDeleted: false })
    .select("-__v")
    .lean();
  console.log(":::::::::::::From DB");
  await redisService.post({
    key: "facilitiesAndPrograms",
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });
  return result;
};

const getSingleFacilitiesAndProgramsFromDB = async (
  id: string,
): Promise<IFacilitiesAndPrograms> => {
  const result = await FacilitiesAndPrograms.findById(id)
    .select("-__v")
    .where({ isDeleted: false })
    .lean();
  if (!result) {
    throw new ApiError(404, "Facilities and programs not found");
  }
  return result;
};

const updateFacilitiesAndProgramsInDB = async (
  id: string,
  payload: IFacilitiesAndPrograms,
): Promise<IFacilitiesAndPrograms> => {
  const result = await FacilitiesAndPrograms.findByIdAndUpdate(id, payload, {
    new: true,
  })
    .where({ isDeleted: false })
    .lean();
  if (!result) {
    throw new ApiError(404, "Facilities and programs not found");
  }
  await redisService.del("facilitiesAndPrograms");
  return result;
};

const deleteFacilitiesAndProgramsFromDB = async (
  id: string,
): Promise<IFacilitiesAndPrograms> => {
  const result = await FacilitiesAndPrograms.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );
  if (!result) {
    throw new ApiError(404, "Facilities and programs not found");
  }
  await redisService.del("facilitiesAndPrograms");
  return result;
};

export const FacilitiesAndProgramsServices = {
  createFacilitiesAndProgramsIntoDB,
  getAllFacilitiesAndProgramsFromDB,
  getSingleFacilitiesAndProgramsFromDB,
  updateFacilitiesAndProgramsInDB,
  deleteFacilitiesAndProgramsFromDB,
};
