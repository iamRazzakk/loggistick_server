import { JwtPayload } from "jsonwebtoken";
import { IVehicleAssign, VehicleAssignModel } from "./vehicleassign.interface";
import { VehicleAssign } from "./vehicleassign.model";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { Driverrating } from "../driverrating/driverrating.model";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";

const createVehicleAssignIntoDB = async (
  user: JwtPayload,
  payload: IVehicleAssign,
) => {
  payload.assignedBy = new Types.ObjectId(user.userId);
  payload.assignedAt = new Date();
  const data = await VehicleAssign.create(payload);
  return data;
};

const getAllVehicleAssignsFromDB = async (query: Record<string, unknown>) => {
  const qb = new QueryBuilder(VehicleAssign.find(), query)
    .filter()
    .paginate()
    .populate(["driverId", "vehicleId"], {
      driverId: "firstName lastName middleName email phone profile",
      // vehicleId: "name model year",
    })
    .search(["driverId._id"])
    .sort();

  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  const enriched = await Promise.all(
    data.map(async (item) => {
      const row = item.toObject();
      const ratings = await Driverrating.find({ driverId: row.driverId._id })
        .select("rating")
        .lean();

      const averageRating = ratings.length
        ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
        : 0;

      (row.driverId as any).averageRating = averageRating;
      return row;
    }),
  );

  return { data: enriched, meta };
};

const getSingleVehicleAssignFromDB = async (vehicleAssignId: string) => {
  const vehicleAssign = await VehicleAssign.findById(vehicleAssignId)
    .populate(["driverId", "vehicleId"], {
      //   driverId: "name email phone profile",
      //   vehicleId: "name model year",
    })
    .lean();

  if (!vehicleAssign) {
    return null;
  }

  const assignedDriverId =
    (vehicleAssign.driverId as { _id?: unknown } | undefined)?._id ??
    vehicleAssign.driverId;

  const driverRatings = await Driverrating.find({
    driverId: assignedDriverId,
  })
    .select("rating")
    .lean();
  const averageRating = driverRatings.length
    ? driverRatings.reduce(
        (ratingSum, driverRating) => ratingSum + driverRating.rating,
        0,
      ) / driverRatings.length
    : 0;

  return {
    ...vehicleAssign,
    averageRating,
  };
};

const updateVehicleAssignIntoDB = async (
  id: string,
  payload: IVehicleAssign,
) => {
  const currentAssignment = await VehicleAssign.findById(id).lean();
  if (!currentAssignment) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Vehicle assignment not found");
  }

  const nextDriverId = payload.driverId ?? currentAssignment.driverId;
  const nextVehicleId = payload.vehicleId ?? currentAssignment.vehicleId;

  const anotherAssignment = await VehicleAssign.findOne({
    driverId: nextDriverId,
    vehicleId: nextVehicleId,
    _id: { $ne: id },
  }).lean();

  if (anotherAssignment) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "This driver is already assigned to this vehicle",
    );
  }

  try {
    const vehicleAssign = await VehicleAssign.findByIdAndUpdate(id, payload, {
      new: true,
    });

    if (!vehicleAssign) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Vehicle assignment not found");
    }

    return vehicleAssign;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "This driver is already assigned to this vehicle",
      );
    }
    throw error;
  }
};

const deleteVehicleAssignFromDB = async (id: string) => {
  const data = await VehicleAssign.findByIdAndDelete(id).populate(
    ["driverId", "vehicleId"],
    {
      driverId: "name email phone",
      vehicleId: "name model year",
    },
  );
  return data;
};

export const VehicleAssignServices = {
  createVehicleAssignIntoDB,
  getAllVehicleAssignsFromDB,
  getSingleVehicleAssignFromDB,
  updateVehicleAssignIntoDB,
  deleteVehicleAssignFromDB,
};
