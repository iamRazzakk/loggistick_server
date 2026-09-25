import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../../errors/ApiErrors";
import { USER_ROLES } from "../../../../enums/user";
import { Booking } from "../../booking/booking.model";
import { Types } from "mongoose";
import { addDays, format } from "date-fns";
import { Driverrating } from "../../driverrating/driverrating.model";

const assertCanViewBooking = (
  user: JwtPayload,
  booking: { userId: unknown; driverId: unknown },
) => {
  const uid = user.id;
  const allowed =
    String(booking.userId) === uid ||
    String(booking.driverId) === uid ||
    user.role === USER_ROLES.SUPER_ADMIN;

  if (!allowed) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You cannot view this booking");
  }
};

const getMyBookingsOnGoingDataFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const bookings = await Booking.find({
    userId: user.id,
    ...(query.bookingStatus ? { bookingStatus: query.bookingStatus } : {}),
  }).lean();
  return bookings;
};

const getMyBookingDetailsDataFromDB = async (user: JwtPayload, id: string) => {
  const booking = await Booking.findById(id).lean();
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }
  // @ts-ignore
  assertCanViewBooking(user, booking);
  return booking;
};
//  get all upcoming bookings

const getAllUpcomingBookingsFromDB = async (user: JwtPayload) => {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const bookings = await Booking.find({
    $or: [
      { userId: new Types.ObjectId(user.id) },
      { driverId: new Types.ObjectId(user.id) },
    ],
    serviceDate: { $gte: tomorrow },
  })
    .populate({
      path: "driverId",
      select: "firstName lastName middleName profile contuct",
    })
    .lean();
  return bookings[0];
};
// need to show only completed bookings
const getRecentActivityFromDB = async (user: JwtPayload) => {
  const bookings = await Booking.find({
    $or: [
      { userId: new Types.ObjectId(user.id) },
      { driverId: new Types.ObjectId(user.id) },
    ],
    bookingStatus: "completed",
  })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();
  return bookings.length > 0 ? bookings[0] : [];
};

const getDriverOverviewDataFromDB = async (user: JwtPayload) => {
  const totalTrips = await Booking.countDocuments({
    driverId: new Types.ObjectId(user.id),
  }).lean();
  const totalCompletedTrips = await Booking.countDocuments({
    driverId: new Types.ObjectId(user.id),
    bookingStatus: "completed",
  }).lean();
  // TODO::: get total earnings
  const totalEarnings = 0;
  return { totalTrips, totalCompletedTrips, totalEarnings };
};

// user on going booking
const getUserOnGoingBookingTodayFromDB = async (user: JwtPayload) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const booking = await Booking.findOne({
    userId: new Types.ObjectId(user.id),
    serviceDate: today,
  })
    .populate({
      path: "driverId",
      select: "firstName lastName middleName profile contact",
    })
    .lean();

  if (!booking) return { driverRating: 0, totalTripCompleted: 0 };

  const driverId = (booking.driverId as { _id?: Types.ObjectId } | null)?._id;
  if (!driverId) {
    return { ...booking, driverRating: 0, totalTripCompleted: 0 };
  }

  const [ratings, totalTripCompleted] = await Promise.all([
    Driverrating.find({ driverId }).select("rating").lean(),
    Booking.countDocuments({
      driverId,
      bookingStatus: "completed",
    }),
  ]);

  const driverRating = ratings.length
    ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length
    : 0;

  return {
    ...booking,
    driverId: {
      ...(booking.driverId as object),
      driverRating,
      totalTripCompleted,
    },
  };
};

export const AppApiBookingService = {
  getMyBookingsOnGoingDataFromDB,
  getMyBookingDetailsDataFromDB,
  getAllUpcomingBookingsFromDB,
  getRecentActivityFromDB,
  getDriverOverviewDataFromDB,
  getUserOnGoingBookingTodayFromDB,
};
