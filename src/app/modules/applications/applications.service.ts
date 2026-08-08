import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { User } from "../user/user.model";

const updateDriverApplicationsStatusToDB = async (
  id: string,
  applicationStatus: "approved" | "rejected",
) => {
  const driver = await User.findByIdAndUpdate(
    id,
    { applicationStatus },
    { new: true },
  );
  if (!driver) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Driver not found");
  }
  return driver;
};

export const ApplicationsServices = {
  updateDriverApplicationsStatusToDB,
};
