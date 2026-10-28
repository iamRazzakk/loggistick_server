import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { User } from "../user/user.model";
import QueryBuilder from "../../builder/queryBuilder";
import { USER_ROLES } from "../../../enums/user";
import { VehicleAssign } from "../vehicleassign/vehicleassign.model";

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
  // TODO: need to send the email to the driver

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
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  if (!data.length) {
    return { data, meta };
  }

  const assignments = await VehicleAssign.find({
    driverId: { $in: data.map((driver) => driver._id) },
  })
    .populate("vehicleId")
    .lean();

  const assignmentByDriver = new Map(
    assignments.map((assignment) => [String(assignment.driverId), assignment]),
  );

  const enriched = data.map((driver) => ({
    ...driver,
    vehicleAssign: assignmentByDriver.get(String(driver._id)) ?? null,
  }));

  return { data: enriched, meta };
};

export const ApplicationsServices = {
  updateDriverApplicationsStatusToDB,
  getAllDriverFromDB,
};
