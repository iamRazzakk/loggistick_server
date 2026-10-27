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
import ExcelJS from "exceljs";

import {
  bookingQueue,
  bookingQueueEvents,
  CREATE_RECURRING_BOOKINGS_JOB,
} from "../../../queue/booking.queue";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enums/user";
import {
  applyServerFare,
  fareAfterChargeOutcome,
  getTripPrice,
  handlePayment,
  presentBookingForViewer,
  presentBookingsForViewer,
  toBookingErrorMessage,
} from "./booking.utils";
import {
  sendNotifications,
  sendPushNotification,
} from "../../../helpers/notificationsHelper";

import { Driverrating } from "../driverrating/driverrating.model";
import {
  buildApprovedBookingFilter,
  buildPendingBookingFilter,
  buildTripHistoryFilter,
} from "./booking.query";
import { LOCKED_FARE_FIELDS } from "./booking.constant";
import { pickupAppointmentError } from "../appApi/apiBooking/booking.helper";

const JOB_WAIT_MS = 120_000;

const createBookingIntoDB = async (user: JwtPayload, payload: IBooking) => {
  // remove locked fare fields from payload
  for (const key of LOCKED_FARE_FIELDS) {
    delete payload[key];
  }

  const timeError = pickupAppointmentError(
    payload.pickupTime,
    payload.appointmentTime,
  );
  if (timeError) throw new ApiError(StatusCodes.BAD_REQUEST, timeError);
  const actor = await User.findById(user.id).select("role");

  if (actor?.role === USER_ROLES.SUPER_ADMIN) {
    payload.isApproved = "approved";
    payload.bookingStatus = payload.driverId ? "assigned" : "confirmed";
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
    payload.bookingStatus = "pending";
    delete payload.driverId;
  }

  payload.userId = new Types.ObjectId(payload.userId ?? user.id);
  const riderId =
    actor?.role === USER_ROLES.USER ? user.id : String(payload.userId);
  const quote = await getTripPrice({
    pickup: payload.pickupLocation as [number, number],
    dropoff: payload.dropOffLocation as [number, number],
    stop: payload.stopAddress?.length
      ? (payload.stopAddress as [number, number])
      : undefined,
    payerId: payload.payerSource?.toString(),
    countyId: (
      payload as IBooking & { countyId?: string }
    ).countyId?.toString(),
    userId: riderId,
    tripType: payload.tripType,
    mobilityRequirements: payload.mobilityRequirements?.toString(),
    serviceDate: payload.serviceDate,
    actualGpsMileage: payload.actualGpsMileage,
  });
  applyServerFare(payload, quote);

  if (!payload.recurringBooking) {
    const created = await Booking.create(payload);
    return presentBookingForViewer(created.toObject(), actor?.role);
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

    const created = await job.waitUntilFinished(
      bookingQueueEvents,
      JOB_WAIT_MS,
    );
    return presentBookingsForViewer(created, actor?.role);
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
  const id = new Types.ObjectId(user.id);
  const mine =
    user.role === USER_ROLES.USER
      ? { userId: id }
      : user.role === USER_ROLES.DRIVER
        ? { driverId: id }
        : { $or: [{ userId: id }, { driverId: id }] };

  const qb = new QueryBuilder(
    // need to check user or driver id
    Booking.find({
      ...mine,
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

  return {
    data: presentBookingsForViewer(data, user.role),
    meta,
  };
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

  const bookingFilter = await buildPendingBookingFilter(query.searchTerm);

  const qb = new QueryBuilder(
    Booking.find(bookingFilter).select(
      "userId driverId mobilityRequirements payerSource bookingStatus isApproved tripType tripReason serviceDate appointmentTime pickupTime returnTime passengerSeats price pickupLocation dropOffLocation stopAddress recurringBooking createdAt",
    ),
    safeQuery,
  )
    .filter()
    .sort()
    .paginate()
    .populate(["userId", "driverId", "mobilityRequirements", "payerSource"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile contact",
      mobilityRequirements: "name price icon",
      payerSource: "name type",
    });

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  return { data, meta };
};

// all approved bookings
const getAllApprovedBookingsFromDB = async (
  user: JwtPayload,
  query: Record<string, any>,
) => {
  const { searchTerm, unassign, ...restQuery } = query;
  const bookingFilter = await buildApprovedBookingFilter(searchTerm);

  // false / omitted: no extra filter. true: only bookings with no driver.
  if (String(unassign).toLowerCase() === "true") {
    delete bookingFilter.bookingStatus;
    bookingFilter.driverId = { $in: [null] };
  }

  const qb = new QueryBuilder(Booking.find(bookingFilter), restQuery)
    .filter()
    .sort();
  qb.modelQuery = qb.modelQuery.populate([
    { path: "userId", select: "firstName lastName middleName profile" },
    { path: "mobilityRequirements", select: "name price icon" },
    { path: "driverId", select: "firstName lastName middleName" },
    {
      path: "countyId",
      select: "payersId",
      populate: { path: "payersId", select: "name type" },
    },
  ]);
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
  const {
    searchTerm: _searchTerm,
    serviceDate: _serviceDate,
    driverId: _driverId,
    payerSource: _payerSource,
    payerId: _payerId,
    unassign,
    ...restQuery
  } = query;

  if (!restQuery.sort) {
    restQuery.sort = "-serviceDate";
  }

  const bookingFilter = await buildTripHistoryFilter(query);

  if (String(unassign).toLowerCase() === "true") {
    bookingFilter.driverId = { $in: [null] };
  }

  const qb = new QueryBuilder(Booking.find(bookingFilter), restQuery)
    .filter()
    .sort()
    .populate(["userId", "driverId", "mobilityRequirements", "payerSource"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
      mobilityRequirements: "name price icon",
      payerSource: "name type",
    })
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  return {
    data: presentBookingsForViewer(data, _user.role),
    meta,
  };
};

// trip history get in excel file
const getTripHistoryInExcelFromDB = async (
  _user: JwtPayload,
  query: Record<string, any>,
) => {
  const bookingFilter = await buildTripHistoryFilter(query);
  const bookings = await Booking.find(bookingFilter)
    .sort(query.sort || "-serviceDate")
    .populate("userId", "firstName middleName lastName profile")
    .populate("driverId", "firstName middleName lastName profile")
    .lean();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Trip History");
  worksheet.columns = [
    { header: "Booking Id", key: "bookingId", width: 28 },
    { header: "Rider", key: "rider", width: 24 },
    { header: "Driver", key: "driver", width: 24 },
    { header: "Pickup", key: "pickupLocation", width: 22 },
    { header: "Drop Off", key: "dropOffLocation", width: 22 },
    { header: "Stop", key: "stopAddress", width: 22 },
    { header: "Trip Type", key: "tripType", width: 14 },
    { header: "Trip Reason", key: "tripReason", width: 18 },
    { header: "Passenger Seats", key: "passengerSeats", width: 16 },
    { header: "Service Date", key: "serviceDate", width: 16 },
    { header: "Appointment Time", key: "appointmentTime", width: 18 },
    { header: "Pickup Time", key: "pickupTime", width: 14 },
    { header: "Return Time", key: "returnTime", width: 14 },
    { header: "Recurring", key: "recurringBooking", width: 12 },
    { header: "Selected Days", key: "selectedDate", width: 28 },
    { header: "End Date", key: "endDate", width: 14 },
    { header: "Booking Status", key: "bookingStatus", width: 16 },
    { header: "Price", key: "price", width: 12 },
    { header: "Passenger Copay", key: "passengerCoPay", width: 16 },
    {
      header: "Funding Source Charge",
      key: "organizationContribution",
      width: 24,
    },
    { header: "Approval", key: "isApproved", width: 14 },
    { header: "Payment Status", key: "paymentStatus", width: 16 },
    { header: "Created At", key: "createdAt", width: 24 },
  ];
  if (_user.role === USER_ROLES.USER) {
    worksheet.columns = worksheet.columns.filter(
      (column) => column.key !== "organizationContribution",
    );
  }
  bookings.forEach((booking) => {
    const rider = booking.userId as {
      firstName?: string;
      middleName?: string;
      lastName?: string;
    } | null;
    const driver = booking.driverId as {
      firstName?: string;
      middleName?: string;
      lastName?: string;
    } | null;
    worksheet.addRow({
      bookingId: String(booking._id),
      rider: (rider?.firstName, rider?.middleName, rider?.lastName),
      driver: (driver?.firstName, driver?.middleName, driver?.lastName),
      pickupLocation: (booking.pickupLocation ?? []).join(", "),
      dropOffLocation: (booking.dropOffLocation ?? []).join(", "),
      stopAddress: (booking.stopAddress ?? []).join(", "),
      tripType: booking.tripType,
      tripReason: booking.tripReason,
      passengerSeats: booking.passengerSeats,
      serviceDate: booking.serviceDate,
      appointmentTime: booking.appointmentTime,
      pickupTime: booking.pickupTime,
      returnTime: booking.returnTime ?? "",
      recurringBooking: booking.recurringBooking ? "yes" : "no",
      selectedDate: ((booking.selectedDate as string[]) ?? []).join(", "),
      endDate: booking.endDate ?? "",
      bookingStatus: booking.bookingStatus,
      price: booking.price,
      passengerCoPay: booking.passengerCoPay,
      organizationContribution:
        _user.role === USER_ROLES.USER ? "" : booking.organizationContribution,
      isApproved: booking.isApproved,
      paymentStatus: booking.paymentStatus,
      createdAt: (booking as any).createdAt
        ? new Date((booking as any).createdAt).toISOString()
        : "",
    });
  });
  worksheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer().then((buffer: any) => Buffer.from(buffer));
};

// update booking
const PRICING_INPUTS = [
  "pickupLocation",
  "dropOffLocation",
  "stopAddress",
  "tripType",
  "mobilityRequirements",
  "payerSource",
  "serviceDate",
  "actualGpsMileage",
  "countyId",
] as const;

const updateBookingInDB = async (
  id: string,
  payload: IBooking,
  user: JwtPayload,
) => {
  for (const key of LOCKED_FARE_FIELDS) {
    delete payload[key];
  }
  if (payload.bookingStatus === "completed") {
    const payment = await handlePayment(id);
    return {
      checkoutUrl: payment.checkoutUrl,
    };
  }

  const existing = await Booking.findById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  const shouldReprice = PRICING_INPUTS.some(
    (key) => payload[key] !== undefined,
  );
  if (shouldReprice) {
    const merged = { ...existing.toObject(), ...payload };
    const actor = await User.findById(user.id).select("role");
    const riderId =
      actor?.role === USER_ROLES.USER ? user.id : String(merged.userId);
    const quote = await getTripPrice({
      pickup: merged.pickupLocation as [number, number],
      dropoff: merged.dropOffLocation as [number, number],
      stop: merged.stopAddress?.length
        ? (merged.stopAddress as [number, number])
        : undefined,
      payerId: merged.payerSource?.toString(),
      countyId: (
        merged as IBooking & { countyId?: string }
      ).countyId?.toString(),
      userId: riderId,
      tripType: merged.tripType,
      mobilityRequirements: merged.mobilityRequirements?.toString(),
      serviceDate: merged.serviceDate,
      actualGpsMileage: merged.actualGpsMileage,
    });
    applyServerFare(payload, quote);
    if (
      existing.paymentStatus === "paid" &&
      payload.passengerCoPay === existing.passengerCoPay
    ) {
      payload.paymentStatus = "paid";
    }
  }

  if (payload.bookingStatus === "cancelled") {
    const outcome =
      payload.cancellationOutcome ?? existing.cancellationOutcome ?? "both";
    const fundingSourceCharge =
      payload.organizationContribution ??
      existing.organizationContribution ??
      existing.totalPrice ??
      0;
    const passengerCopay =
      payload.passengerCoPay ?? existing.passengerCoPay ?? 0;
    const adjusted = fareAfterChargeOutcome(
      fundingSourceCharge,
      passengerCopay,
      outcome,
    );
    if (passengerCopay > 0 && existing.paymentStatus === "paid") {
      adjusted.paymentStatus = "paid";
    }
    Object.assign(payload, adjusted);
    if (payload.bookingStatus === "cancelled") {
      payload.cancelledBy = new Types.ObjectId(user.id);
    }
  }

  const booking = await Booking.findByIdAndUpdate(id, payload, { new: true });
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }
  const userData = await User.findById(booking.userId).select(
    "firstName lastName role",
  );
  const actorId = user.id?.toString();
  const recipientIds = [booking.userId, booking.driverId]
    .map((id) => id?.toString())
    .filter((id): id is string => Boolean(id) && id !== actorId);

  await sendPushNotification({
    userIds: recipientIds,
    title: `${userData?.firstName} ${userData?.lastName} ${booking.bookingStatus} your trip`,
    body: `${booking.bookingStatus} your trip`,
    data: {
      screen: "booking",
      referenceId: booking._id.toString(),
    },
  });
  return presentBookingForViewer(booking.toObject(), user.role);
};

// get booking by id
const getBookingByIdFromDB = async (id: string, user: JwtPayload) => {
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
    return presentBookingForViewer(
      { ...booking, driverRating: 0, totalTripCompleted: 0 },
      user.role,
    );
  }

  const [ratings, totalTripCompleted] = await Promise.all([
    Driverrating.find({ driverId: driver._id }).select("rating").lean(),
    Booking.countDocuments({ driverId: driver._id }),
  ]);

  const driverRating = ratings.length
    ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length
    : 0;

  return presentBookingForViewer(
    {
      ...booking,
      driverId: {
        ...driver,
        driverRating,
        totalTripCompleted,
      },
    },
    user.role,
  );
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
  countyId?: string,
  userId?: string,
  serviceDate?: string,
  actualGpsMileage?: number,
) => {
  return await getTripPrice({
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    stop: stopAddress,
    payerId,
    countyId,
    userId,
    tripType,
    mobilityRequirements,
    serviceDate,
    actualGpsMileage,
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
  getTripHistoryInExcelFromDB,
};
