import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../../errors/ApiErrors";
import { USER_ROLES } from "../../../../enums/user";
import { Booking } from "../../booking/booking.model";
import { presentBookingForViewer } from "../../booking/booking.utils";
import { Types } from "mongoose";
import { addDays, format } from "date-fns";
import { Driverrating } from "../../driverrating/driverrating.model";
import toMinutes from "./booking.helper";
import {
  CLOSED_BOOKING_STATUSES,
  STORED_BOOKING_STATUSES,
} from "./booking.contant";
import QueryBuilder from "../../../builder/queryBuilder";
import { IBooking } from "../../booking/booking.interface";

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
  const bookingStatus = query.bookingStatus;
  const filter: Record<string, unknown> = {
    $or: [{ userId: user.id }, { driverId: user.id }],
  };

  if (bookingStatus != null && bookingStatus !== "") {
    if (bookingStatus === "pending") {
      filter.serviceDate = { $gte: format(new Date(), "yyyy-MM-dd") };
      filter.bookingStatus = {
        $in: STORED_BOOKING_STATUSES.filter(
          (status) =>
            !(CLOSED_BOOKING_STATUSES as readonly string[]).includes(status),
        ),
      };
    } else if (
      typeof bookingStatus === "string" &&
      (STORED_BOOKING_STATUSES as readonly string[]).includes(bookingStatus)
    ) {
      filter.bookingStatus = bookingStatus;
    } else {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid booking status");
    }
  }
  const bookings = await Booking.find(filter).lean();
  for (const booking of bookings) {
    const cancelledBy = booking?.cancelledBy as Types.ObjectId;
    (booking as { isCancelledByYou?: boolean }).isCancelledByYou =
      cancelledBy != null && cancelledBy.equals(user.id!);
  }
  return bookings.map((booking) => presentBookingForViewer(booking, user.role));
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
  return presentBookingForViewer(booking, user.role);
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
  return bookings[0]
    ? presentBookingForViewer(bookings[0], user.role)
    : bookings[0];
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
  return bookings.length > 0
    ? presentBookingForViewer(bookings[0], user.role)
    : [];
};

const getDriverOverviewDataFromDB = async (user: JwtPayload) => {
  const [totalTrips, totalCompletedTrips, totalEarningsAmount] =
    await Promise.all([
      Booking.countDocuments({
        driverId: new Types.ObjectId(user.id),
      }).lean(),
      Booking.countDocuments({
        driverId: new Types.ObjectId(user.id),
        bookingStatus: "completed",
      }).lean(),
      Booking.find({
        bookingStatus: "completed",
        driverId: new Types.ObjectId(user.id),
      })
        .select("price organizationContribution passengerCoPay")
        .lean(),
    ]);
  const totalEarnings =
    totalEarningsAmount?.reduce(
      (sum, row) =>
        sum +
        (row?.organizationContribution ??
          row?.passengerCoPay ??
          row?.price ??
          0),
      0,
    ) ?? 0;
  return { totalTrips, totalCompletedTrips, totalEarnings };
};

// user on going booking
const getUserOnGoingBookingTodayFromDB = async (user: JwtPayload) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [booking] = await Booking.aggregate<IBooking & { _id: Types.ObjectId }>(
    [
      {
        $match: {
          userId: new Types.ObjectId(user.id),
          serviceDate: today,
          bookingStatus: { $nin: ["cancelled", "completed", "pending"] },
          driverId: { $ne: null },
        },
      },
      {
        $set: {
          pickupMinutes: {
            $add: [
              {
                $multiply: [
                  {
                    $mod: [
                      { $toInt: { $substrBytes: ["$pickupTime", 0, 2] } },
                      12,
                    ],
                  },
                  60,
                ],
              },
              { $toInt: { $substrBytes: ["$pickupTime", 3, 2] } },
              {
                $cond: [
                  { $eq: [{ $substrBytes: ["$pickupTime", 6, 2] }, "PM"] },
                  720,
                  0,
                ],
              },
            ],
          },
        },
      },
      { $sort: { pickupMinutes: 1 } },
      { $limit: 1 },
      { $unset: "pickupMinutes" },
    ],
  );

  if (!booking) return [];
  await Booking.populate(booking, {
    path: "driverId",
    select: "firstName lastName middleName profile contact",
  });

  const driverId = (
    booking.driverId as unknown as { _id?: Types.ObjectId } | null
  )?._id;
  if (!driverId) {
    return presentBookingForViewer(
      { ...booking, driverRating: 0, totalTripCompleted: 0 },
      user.role,
    );
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
  return presentBookingForViewer(
    {
      ...booking,
      driverId: {
        ...(booking.driverId as object),
        driverRating,
        totalTripCompleted,
      },
    },
    user.role,
  );
};

// driver on current booking (Trip maybe today lot's of but we need to show most recent one)

const getDriverCurrentBookingFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const qb = new QueryBuilder<IBooking>(
    Booking.find({
      driverId: new Types.ObjectId(user.id),
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: { $nin: ["cancelled", "completed"] },
    }),
    query,
  )
    .filter()
    .populate(["userId"], {
      userId: "firstName lastName middleName profile contact",
    });

  const bookings = await qb.modelQuery.lean().exec();
  const sortedBookings = bookings.sort(
    (a: any, b: any) =>
      (toMinutes(a.pickupTime) ?? 0) - (toMinutes(b.pickupTime) ?? 0),
  );
  const limit = Number(query.limit) || 10;
  const page = Number(query.page) || 1;
  const total = sortedBookings.length;
  const data = sortedBookings.slice((page - 1) * limit, page * limit);

  return {
    data,
    meta: {
      total,
      limit,
      page,
      totalPage: Math.ceil(total / limit),
    },
  };
};

// next 3 trips

const getDriverNextTripFromDB = async (user: JwtPayload) => {
  const current = await getDriverCurrentBookingFromDB(user, { limit: 1 });
  const currentBooking = current.data[0];
  const currentId = currentBooking?._id ? String(currentBooking._id) : null;

  const bookings = await Booking.find({
    driverId: new Types.ObjectId(user.id),
    serviceDate: { $gte: format(new Date(), "yyyy-MM-dd") },
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
    .slice(0, 3)
    .map((booking) => presentBookingForViewer(booking, user.role));
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
  return (bookings ?? []).map((booking) =>
    presentBookingForViewer(booking, user.role),
  );
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
