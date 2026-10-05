import { Booking } from "./booking.model";
import { IBooking } from "./booking.interface";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import QueryBuilder from "../../builder/queryBuilder";
import { generateRecurringDates } from "../../../util/recurringBooking";
import { Types } from "mongoose";
import { format } from "date-fns";
import { randomUUID } from "crypto";
import {
  bookingQueue,
  bookingQueueEvents,
  CREATE_RECURRING_BOOKINGS_JOB,
} from "../../../queue/booking.queue";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enums/user";
import {
  getTripPrice,
  handlePayment,
  toBookingErrorMessage,
} from "./booking.utils";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import stripe from "../../../config/stripe";
import { Driverrating } from "../driverrating/driverrating.model";

const JOB_WAIT_MS = 120_000;

const createBookingIntoDB = async (user: JwtPayload, payload: IBooking) => {
  const isAdmin = await User.findById({ _id: user.id }).select("role");
  if (isAdmin?.role === USER_ROLES.SUPER_ADMIN) {
    payload.isApproved = "approved";
    if (payload.driverId) {
      await sendNotifications({
        receiver: payload.driverId,
        sender: user.id,
        text: "New booking created",
        referenceId: Math.random().toString(36).substring(2, 15),
        screen: "booking",
        type: "user",
      });
    }
  } else {
    payload.isApproved = "pending";
  }
  if (payload.userId) {
    payload.userId = new Types.ObjectId(payload.userId);
  } else {
    payload.userId = new Types.ObjectId(user.id);
  }

  payload.bookingStatus = "pending";

  const quote = await getTripPrice({
    pickup: payload.pickupLocation as [number, number],
    dropoff: payload.dropOffLocation as [number, number],
    stop: payload.stopAddress?.length
      ? (payload.stopAddress as [number, number])
      : undefined,
    payerId: payload.payerSource?.toString(),
    tripType: payload.tripType,
    mobilityRequirements: payload.mobilityRequirements?.toString(),
  });
  payload.price = quote.totalPrice;

  if (!payload.recurringBooking) {
    return await Booking.create(payload);
  }
  if (!payload.endDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "End date is required for recurring booking.",
    );
  }

  if (!payload.selectedDate || payload.selectedDate.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Please select at least one recurring day.",
    );
  }
  const selectedDays = Array.isArray(payload.selectedDate)
    ? payload.selectedDate
    : [payload.selectedDate];
  const recurringDates = generateRecurringDates(
    payload.serviceDate,
    payload.endDate,
    selectedDays,
  );
  if (!recurringDates.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No booking dates found for the selected days and date range.",
    );
  }
  const recurringBatchId = randomUUID();
  try {
    await bookingQueueEvents.waitUntilReady();
    const job = await bookingQueue.add(CREATE_RECURRING_BOOKINGS_JOB, {
      dates: recurringDates,
      payload: {
        ...payload,
        userId: payload.userId.toString(),
        mobilityRequirements: payload.mobilityRequirements.toString(),
        payerSource: payload.payerSource?.toString() || null,
        driverId: payload.driverId?.toString() || null,
        selectedDate: selectedDays,
        bookingStatus: "pending",
        recurringBatchId,
      },
    });

    return await job.waitUntilFinished(bookingQueueEvents, JOB_WAIT_MS);
  } catch (error) {
    await Booking.deleteMany({ recurringBatchId });
    throw new ApiError(StatusCodes.BAD_REQUEST, toBookingErrorMessage(error));
  }
};

// get all my bookings
const getAllMyBookingsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const qb = new QueryBuilder(
    // need to check user or driver id
    Booking.find({
      driverId: new Types.ObjectId(user.id),
    }),
    query,
  )
    .fields()
    .filter()
    .sort()
    .populate(["userId", "driverId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
    })
    .paginate();

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  return { data, meta };
};

// all pending bookings
const getAllBookingsFromDB = async (
  _user: JwtPayload,
  query: Record<string, any>,
) => {
  const safeQuery = {
    ...query,
    limit: Math.min(Math.max(Number(query.limit) || 10, 1), 50),
    page: Math.max(Number(query.page) || 1, 1),
  };
  const qb = new QueryBuilder(
    Booking.find({ isApproved: "pending" }).select(
      "userId driverId mobilityRequirements payerSource bookingStatus isApproved tripType tripReason serviceDate appointmentTime pickupTime returnTime passengerSeats price pickupLocation dropOffLocation stopAddress recurringBooking createdAt",
    ),
    safeQuery,
  )
    .filter()
    .sort()
    .search(["bookingStatus", "tripReason", "isApproved"])
    .paginate()
    .populate(["userId", "driverId", "mobilityRequirements", "payerSource"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile contact",
      mobilityRequirements: "name price icon",
      payerSource: "name type",
    });
  const data = await qb.modelQuery.lean().exec();
  return {
    data,
    meta: {
      page: safeQuery.page,
      limit: safeQuery.limit,
    },
  };
};

// all approved bookings
const getAllApprovedBookingsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const qb = new QueryBuilder(
    Booking.find({ bookingStatus: "assigned", isApproved: "approved" }),
    query,
  )
    .filter()
    .sort()
    .search(["bookingStatus", "tripReason", "tripNote"])
    .populate(["userId"], {
      userId: "firstName lastName middleName profile",
    });
  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// trip history
const getTripHistoryFromDB = async (
  _user: JwtPayload,
  query: Record<string, any>,
) => {
  const { serviceDate: _ignored, ...restQuery } = query;
  if (!restQuery.sort) {
    restQuery.sort = "-serviceDate";
  }

  const qb = new QueryBuilder(
    Booking.find({
      driverId: { $exists: true, $ne: null },
      bookingStatus: { $ne: "pending" },
    }),
    restQuery,
  )
    .filter()
    .sort()
    .search(["bookingStatus", "tripReason", "tripNote"])
    .populate(["userId", "driverId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
    })
    .sort()
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// update booking
const updateBookingInDB = async (
  id: string,
  payload: IBooking,
  user: JwtPayload,
) => {
  if (payload.bookingStatus === "cancelled") {
    payload.cancelledBy = new Types.ObjectId(user.id);
  }
  // for payment .....
  if (payload.bookingStatus === "completed") {
    const payment = await handlePayment(id);
    return {
      checkoutUrl: payment.checkoutUrl,
    };
  }
  const booking = await Booking.findByIdAndUpdate(id, payload, { new: true });
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
    
  }
  return booking;
};

// get booking by id
const getBookingByIdFromDB = async (id: string) => {
  const booking = await Booking.findById(id)
    .populate({
      path: "driverId",
      select: "firstName lastName middleName profile contact",
    })
    .lean();

  if (!booking) return [];

  const driver = booking.driverId as {
    _id?: Types.ObjectId;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    profile?: string;
    contact?: string;
  } | null;

  if (!driver?._id) {
    return { ...booking, driverRating: 0, totalTripCompleted: 0 };
  }

  const [ratings, totalTripCompleted] = await Promise.all([
    Driverrating.find({ driverId: driver._id }).select("rating").lean(),
    Booking.countDocuments({ driverId: driver._id }),
  ]);

  const driverRating = ratings.length
    ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length
    : 0;

  return {
    ...booking,
    driverId: {
      ...driver,
      driverRating,
      totalTripCompleted,
    },
  };
};

// scheduled bookings
const getScheduledBookingsFromDB = async (query: Record<string, any>) => {
  const bookings = await Booking.find({
    serviceDate: { $gte: format(new Date(), "yyyy-MM-dd") },
  })
    .populate([
      { path: "userId", select: "firstName lastName middleName profile" },
      { path: "driverId", select: "firstName lastName middleName profile" },
    ])
    .lean();
  const grouped = new Map<string, { driver: any; bookings: any[] }>();

  for (const booking of bookings) {
    const driver = booking.driverId as any;
    const driverKey = driver?._id?.toString();

    if (!driverKey) continue;

    if (!grouped.has(driverKey)) {
      grouped.set(driverKey, { driver, bookings: [] });
    }

    const { driverId: _omit, ...rest } = booking;
    grouped.get(driverKey)!.bookings.push(rest);
  }

  return Array.from(grouped.values()).map((item) => ({
    driver: item.driver,
    serviceDate: format(new Date(item.bookings[0]?.serviceDate), "yyyy-MM-dd"),
    bookings: item.bookings,
  }));
};

// single rider booking history

const getSingleRiderBookingHistoryFromDB = async (id: string) => {
  const bookings = await Booking.find({ userId: new Types.ObjectId(id) })
    .populate([
      { path: "userId", select: "firstName lastName middleName profile" },
      { path: "driverId", select: "firstName lastName middleName profile" },
    ])
    .sort("-serviceDate")
    .lean();
  return bookings;
};

const calculateTotalTripPrice = async (
  pickupLocation: [number, number],
  dropoffLocation: [number, number],
  stopAddress?: [number, number],
  payerId?: string,
  tripType: "one-way" | "round-trip" = "one-way",
  mobilityRequirements?: string,
) => {
  return await getTripPrice({
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    stop: stopAddress,
    payerId,
    tripType,
    mobilityRequirements,
  });
};

export const BookingServices = {
  createBookingIntoDB,
  getAllMyBookingsFromDB,
  getAllBookingsFromDB,
  getAllApprovedBookingsFromDB,
  getTripHistoryFromDB,
  updateBookingInDB,
  getBookingByIdFromDB,
  getScheduledBookingsFromDB,
  getSingleRiderBookingHistoryFromDB,
  calculateTotalTripPrice,
};
