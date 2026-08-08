import ApiError from "../../../errors/ApiErrors";
import { redisService } from "../../../redis/redis.service";
import { IFundingSources } from "./funding_sources.interface";
import { FundingSources } from "./funding_sources.model";

const createFundingSourcesIntoDB = async (
  payload: IFundingSources,
): Promise<IFundingSources> => {
  const result = await FundingSources.create(payload);
  await redisService.del("fundingSources");
  if (!result) {
    throw new ApiError(400, "Failed to create funding sources");
  }
  return result;
};

const getAllFundingSourcesFromDB = async (): Promise<IFundingSources[]> => {
  //
  const cachedData = await redisService.get("fundingSources");
  if (cachedData) {
    console.log(":::::::::::::From Cache");
    return JSON.parse(cachedData);
  }
  const result = await FundingSources.find({ isDeleted: false }).select("-__v").lean();
  console.log(":::::::::::::From DB");
  await redisService.post({
    key: "fundingSources",
    value: JSON.stringify(result),
    expiration: 24 * 60 * 60, // 24 hours
  });
  return result;
};

const getSingleFundingSourcesFromDB = async (
  id: string,
): Promise<IFundingSources> => {
  const result = await FundingSources.findById(id)
    .select("-__v")
    .where({ isDeleted: false })
    .lean();
  if (!result) {
    throw new ApiError(404, "Funding sources not found");
  }
  return result;
};

const updateFundingSourcesInDB = async (
  id: string,
  payload: IFundingSources,
): Promise<IFundingSources> => {
  const result = await FundingSources.findByIdAndUpdate(id, payload, {
    new: true,
  }).where({ isDeleted: false }).lean();
  if (!result) {
    throw new ApiError(404, "Funding sources not found");
  }
  await redisService.del("fundingSources");
  return result;
};

const deleteFundingSourcesFromDB = async (
  id: string,
): Promise<IFundingSources> => {
  const result = await FundingSources.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );
  if (!result) {
    throw new ApiError(404, "Funding sources not found");
  }
  await redisService.del("fundingSources");
  return result;
};

export const FundingSourcesServices = {
  createFundingSourcesIntoDB,
  getAllFundingSourcesFromDB,
  getSingleFundingSourcesFromDB,
  updateFundingSourcesInDB,
  deleteFundingSourcesFromDB,
};
