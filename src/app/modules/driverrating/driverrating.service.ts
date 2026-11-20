import { JwtPayload } from "jsonwebtoken";
import { IDriverrating } from "./driverrating.interface";
import { Driverrating } from "./driverrating.model";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import { USER_ROLES } from "../../../enums/user";

const createDriverRatingIntoDB = async (
  payload: IDriverrating,
  user: JwtPayload,
) => {
  if (!Types.ObjectId.isValid(String(payload.tripId))) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Valid tripId is required");
  }
  const trip = await Booking.findById(String(payload.tripId)).lean();
  if (trip?.bookingStatus !== "completed") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Trip is not completed");
  }
  // Only the rider of the trip can rate it; the driver comes from the trip.
  if (String(trip.userId) !== String(user.id)) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You can only rate your own trip");
  }
  if (!trip.driverId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Trip has no driver");
  }
  const driverRating = await Driverrating.create({
    userId: new Types.ObjectId(user.id),
    driverId: trip.driverId,
    tripId: trip._id,
    rating: Number(payload.rating),
    comment: typeof payload.comment === "string" ? payload.comment : "",
  });
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

const updateDriverRatingIntoDB = async (
  id: string,
  payload: IDriverrating,
  user: JwtPayload,
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid rating id");
  }
  const existing = await Driverrating.findById(id).select("userId").lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Rating not found");
  }
  if (
    user.role !== USER_ROLES.SUPER_ADMIN &&
    String(existing.userId) !== String(user.id)
  ) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You can only update your own rating",
    );
  }
  // Only the score and comment can change (not driver/trip/user).
  const update: Record<string, unknown> = {};
  if (payload.rating !== undefined) update.rating = Number(payload.rating);
  if (typeof payload.comment === "string") update.comment = payload.comment;

  const driverRating = await Driverrating.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
  return driverRating;
};

export const DriverratingServices = {
  createDriverRatingIntoDB,
  getAllDriverRatingsFromDB,
  getSingleDriverRatingFromDB,
  updateDriverRatingIntoDB,
};
