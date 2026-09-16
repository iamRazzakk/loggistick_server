import { JwtPayload } from "jsonwebtoken";
import { IDriverrating } from "./driverrating.interface";
import { Driverrating } from "./driverrating.model";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";

const createDriverRatingIntoDB = async (
  payload: IDriverrating,
  user: JwtPayload,
) => {
  payload.userId = new Types.ObjectId(user.userId);
  const trip = await Booking.findById(payload.tripId).lean();
  if (trip?.bookingStatus !== "completed") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Trip is not completed");
  }
  const driverRating = await Driverrating.create(payload);
  return driverRating;
};

const getAllDriverRatingsFromDB = async (
  query: Record<string, unknown>,
  id: string,
) => {
  const qb = new QueryBuilder(
    Driverrating.find({ driverId: new Types.ObjectId(id) }),
    query,
  )
    .filter()
    .paginate()
    .populate(["driverId", "tripId"], {
      driverId: "firstName lastName middleName email phone profile",
    });
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return {
    data,
    meta,
  };
};

const getSingleDriverRatingFromDB = async (id: string) => {
  const driverRating = await Driverrating.findById(id).populate(
    ["driverId", "tripId"],
    {
      driverId: "firstName lastName middleName email phone profile",
    },
  );
  return driverRating;
};

const updateDriverRatingIntoDB = async (id: string, payload: IDriverrating) => {
  const driverRating = await Driverrating.findByIdAndUpdate(id, payload, {
    new: true,
  });
  return driverRating;
};

export const DriverratingServices = {
  createDriverRatingIntoDB,
  getAllDriverRatingsFromDB,
  getSingleDriverRatingFromDB,
  updateDriverRatingIntoDB,
};
