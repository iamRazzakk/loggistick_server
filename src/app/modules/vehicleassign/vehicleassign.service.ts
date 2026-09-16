import { JwtPayload } from "jsonwebtoken";
import { IVehicleAssign, VehicleAssignModel } from "./vehicleassign.interface";
import { VehicleAssign } from "./vehicleassign.model";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { Driverrating } from "../driverrating/driverrating.model";

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

const getSingleVehicleAssignFromDB = async (id: string) => {
  const data = await VehicleAssign.findById(id)
    .populate(["driverId", "vehicleId"], {
      //   driverId: "name email phone profile",
      //   vehicleId: "name model year",
    })
    .lean();

  const ratings = await Driverrating.find({ driverId: data?.driverId })
    .select("rating")
    .lean();
  const averageRating = ratings.length
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : 0;
  (data as any).averageRating = averageRating;
  return data;
};

const updateVehicleAssignIntoDB = async (
  id: string,
  payload: IVehicleAssign,
) => {
  const data = await VehicleAssign.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return data;
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
