import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { ICompanySupport } from "./company_support.interface";
import { CompanySupport } from "./company_support.model";

// Singleton document: create it if it doesn't exist, otherwise update it
const upsertCompanySupportIntoDB = async (
  payload: Partial<ICompanySupport>,
): Promise<ICompanySupport> => {
  const result = await CompanySupport.findOneAndUpdate(
    {},
    { $set: payload },
    { new: true, upsert: true },
  )
    .select("-__v")
    .lean();
  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Failed to save company support",
    );
  }
  return result;
};

const getCompanySupportFromDB = async (): Promise<ICompanySupport> => {
  const result = await CompanySupport.findOne({}).select("-__v").lean();
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Company support not found");
  }
  return result;
};

export const CompanySupportServices = {
  upsertCompanySupportIntoDB,
  getCompanySupportFromDB,
};
