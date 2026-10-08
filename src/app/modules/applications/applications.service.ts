import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { User } from "../user/user.model";
import QueryBuilder from "../../builder/queryBuilder";
import { USER_ROLES } from "../../../enums/user";

const updateDriverApplicationsStatusToDB = async (
  id: string,
  payload: {
    applicationStatus: "approved" | "rejected";
    isAdminVerifiedDriver: boolean;
  },
) => {
  const driver = await User.findByIdAndUpdate(
    id,
    {
      applicationStatus: payload.applicationStatus,
      isAdminVerifiedDriver: payload.isAdminVerifiedDriver,
    },
    { new: true },
  );
  if (!driver) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Driver not found");
  }
  return driver;
};

const getAllDriverFromDB = async (query: Record<string, any>) => {
  const qb = new QueryBuilder(
    User.find({
      role: USER_ROLES.DRIVER,
      isAdminVerifiedDriver: true,
      applicationStatus: "approved",
    }),
    query,
  )
    .paginate()
    .sort();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

export const ApplicationsServices = {
  updateDriverApplicationsStatusToDB,
  getAllDriverFromDB,
};
