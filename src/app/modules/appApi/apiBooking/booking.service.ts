import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../../errors/ApiErrors";
import { USER_ROLES } from "../../../../enums/user";
import { Booking } from "../../booking/booking.model";
import { Types } from "mongoose";
import { addDays, format } from "date-fns";
import { Driverrating } from "../../driverrating/driverrating.model";
import toMinutes from "./booking.helper";

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

  const userId = String(user.id);
  for (const booking of bookings) {
    (booking as any).isCancelledByYou =
      booking?.cancelledBy != null && String(booking?.cancelledBy) === userId;
  }
  return bookings;
};

const getMyBookingDetailsDataFromDB = async (user: JwtPayload, id: string) => {
  const booking = await Booking.findById(id)
    .populate({
      path: "mobilityRequirements",
      select: "name",
    })
    .lean();
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

  if (!booking) return [];
  const driverId = (booking?.driverId as { _id?: Types.ObjectId } | null)?._id;
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

// driver on current booking (Trip maybe today lot's of but we need to show most recent one)

const getDriverCurrentBookingFromDB = async (user: JwtPayload) => {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaysBookings = await Booking.find({
    driverId: new Types.ObjectId(user.id),
    serviceDate: today,
    bookingStatus: { $ne: "cancelled" },
  })
    .populate({
      path: "userId",
      select: "firstName lastName middleName profile contact",
    })
    .lean();

  const bookingsByPickup = todaysBookings
    .flatMap((booking) => {
      const pickupMinutes = toMinutes(booking.pickupTime);
      return pickupMinutes === null ? [] : [{ booking, pickupMinutes }];
    })
    .sort((a, b) => a.pickupMinutes - b.pickupMinutes);

  const activeOverdueBooking = bookingsByPickup.find(
    (item) =>
      item.pickupMinutes <= currentMinutes &&
      item.booking.bookingStatus !== "completed",
  );

  const upcomingBooking = bookingsByPickup.find(
    (item) => item.pickupMinutes > currentMinutes,
  );

  const currentBooking =
    activeOverdueBooking?.booking ?? upcomingBooking?.booking;

  if (!currentBooking) return [];

  const passenger = currentBooking.userId as { _id?: Types.ObjectId } | null;

  const completedTripCount = passenger
    ? await Booking.countDocuments({
        userId: passenger._id,
        bookingStatus: "completed",
      })
    : 0;

  return { ...currentBooking, completedTrips: completedTripCount };
};

// next 3 trips

const getDriverNextTripFromDB = async (user: JwtPayload) => {
  const current = await getDriverCurrentBookingFromDB(user);
  const currentId =
    current && !Array.isArray(current) && "_id" in current
      ? String((current as { _id: unknown })._id)
      : null;

  const today = format(new Date(), "yyyy-MM-dd");
  const bookings = await Booking.find({
    driverId: new Types.ObjectId(user.id),
    serviceDate: { $gte: today },
    bookingStatus: { $nin: ["cancelled", "completed"] },
    ...(currentId ? { _id: { $ne: currentId } } : {}),
  })
    .populate({
      path: "userId",
      select: "firstName lastName middleName profile contact",
    })
    .lean();

  return bookings
    .sort((a, b) => {
      if (a.serviceDate !== b.serviceDate) {
        return a.serviceDate < b.serviceDate ? -1 : 1;
      }
      return (toMinutes(a.pickupTime) ?? 0) - (toMinutes(b.pickupTime) ?? 0);
    })
    .slice(0, 3);
};

// Driver all trip list sort last create need to show in first
const getAllDriverTripsListFromDB = async (user: JwtPayload) => {
  const bookings = await Booking.find({
    driverId: user.id,
  })
    .populate({
      path: "userId",
      select: "firstName lastName middleName profile contact",
    })
    .sort({ createdAt: -1 })
    .lean();
  return bookings ?? [];
};

// total Trip, completed trip, total paid

const getUserTotalTripDetailsFromDB = async (user: JwtPayload) => {
  const totalTrips = await Booking.countDocuments({
    userId: new Types.ObjectId(user.id),
  }).lean();
  const totalCompletedTrips = await Booking.countDocuments({
    userId: new Types.ObjectId(user.id),
    bookingStatus: "completed",
  }).lean();
  // count total price of the trips
  const totalPaid = await Booking.find({
    userId: new Types.ObjectId(user.id),
    bookingStatus: "completed",
  })
    .select("price")
    .lean();
  const totalPaidAmount =
    totalPaid?.reduce((sum, row) => sum + (row.price ?? 0), 0) ?? 0;
  return { totalTrips, totalCompletedTrips, totalPaidAmount };
};
// overview data
const driverOverViewDataFromDB = async (user: JwtPayload) => {
  const [todayTotalTrips, totalTodayCompleteTrips] = await Promise.all([
    Booking.countDocuments({
      driverId: new Types.ObjectId(user.id),
      serviceDate: format(new Date(), "yyyy-MM-dd"),
    }).lean(),
    Booking.countDocuments({
      driverId: new Types.ObjectId(user.id),
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: "completed",
    }).lean(),
  ]);

  const totalRemainingTrips = todayTotalTrips - totalTodayCompleteTrips;
  return { todayTotalTrips, totalTodayCompleteTrips, totalRemainingTrips };
};

export const AppApiBookingService = {
  getMyBookingsOnGoingDataFromDB,
  getMyBookingDetailsDataFromDB,
  getAllUpcomingBookingsFromDB,
  getRecentActivityFromDB,
  getDriverOverviewDataFromDB,
  getUserOnGoingBookingTodayFromDB,
  getDriverCurrentBookingFromDB,
  getDriverNextTripFromDB,
  getAllDriverTripsListFromDB,
  getUserTotalTripDetailsFromDB,
  driverOverViewDataFromDB,
};
