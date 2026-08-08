import { Booking } from "./booking.model";
import { IBooking } from "./booking.interface";
import { JwtPayload } from "jsonwebtoken";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import QueryBuilder from "../../builder/queryBuilder";
import { generateRecurringDates } from "../../../util/recurringBooking";
import { Types } from "mongoose";
import { format } from "date-fns";

const createBookingIntoDB = async (user: JwtPayload, payload: IBooking) => {
  if (payload.userId) {
    payload.userId = new Types.ObjectId(payload.userId);
  } else {
    payload.userId = new Types.ObjectId(user.id);
  }
  // Normal booking
  if (!payload.recurringBooking) {
    return await Booking.create(payload);
  }

  // Validation
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
    : [payload.selectedDate!];
  const recurringDates = generateRecurringDates(
    payload.serviceDate,
    payload.endDate,
    selectedDays,
  );

  const bookings = recurringDates.map((date) => ({
    ...payload,
    serviceDate: date,
  }));

  return await Booking.insertMany(bookings);
};

// get all my bookings
const getAllMyBookingsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const qb = new QueryBuilder(
    Booking.find({ userId: new Types.ObjectId(user.id) }),
    query,
  )
    .fields()
    .filter()
    .sort()
    .populate(["userId", "driverId", "vehicleId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
      vehicleId: "model",
    })
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// all bookings
const getAllBookingsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const qb = new QueryBuilder(Booking.find({}), query)
    .filter()
    .sort()
    .search([
      "userId.firstName",
      "userId.lastName",
      "userId.middleName",
      "driverId.firstName",
      "driverId.lastName",
      "driverId.middleName",
      "vehicleId.model",
      "bookingStatus",
    ])
    .paginate()
    .populate(["userId", "driverId", "vehicleId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
      vehicleId: "model",
    });
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// trip history (driver)
const getTripHistoryFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const { serviceDate: _ignored, ...restQuery } = query;
  if (!restQuery.sort) {
    restQuery.sort = "-serviceDate";
  }

  const qb = new QueryBuilder(
    Booking.find({ serviceDate: { $lt: today } }),
    restQuery,
  )
    .filter()
    .sort()
    .search(["bookingStatus", "tripReason", "tripNote", "driverId._id"])
    .populate(["userId", "driverId", "vehicleId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
      vehicleId: "model",
    })
    .sort()
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// update booking
const updateBookingInDB = async (id: string, payload: IBooking) => {
  const booking = await Booking.findByIdAndUpdate(id, payload, { new: true });
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }
  return booking;
};

// get booking by id
const getBookingByIdFromDB = async (id: string) => {
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }
  return booking;
};

const getScheduledBookingsFromDB = async (query: Record<string, any>) => {
  const { date, bookingStatus } = query;
  if (!date) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "date is required");
  }

  const bookings = await Booking.find({
    serviceDate: date,
    bookingStatus,
  })
    .populate([
      { path: "userId", select: "firstName lastName middleName profile" },
      { path: "driverId", select: "firstName lastName middleName profile" },
      { path: "vehicleId", select: "model" },
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
    serviceDate: date,
    bookings: item.bookings,
  }));
};
// single rider booking history

const getSingleRiderBookingHistoryFromDB = async (id: string) => {
  const bookings = await Booking.find({ userId: new Types.ObjectId(id) })
    .populate([
      { path: "userId", select: "firstName lastName middleName profile" },
      { path: "driverId", select: "firstName lastName middleName profile" },
      { path: "vehicleId", select: "model" },
    ])
    .sort("-serviceDate")
    .lean();
  return bookings;
};

export const BookingServices = {
  createBookingIntoDB,
  getAllMyBookingsFromDB,
  getAllBookingsFromDB,
  getTripHistoryFromDB,
  updateBookingInDB,
  getBookingByIdFromDB,
  getScheduledBookingsFromDB,
  getSingleRiderBookingHistoryFromDB,
};
