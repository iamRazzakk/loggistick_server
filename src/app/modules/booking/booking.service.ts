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
  BULK_ASSIGN_DRIVERS_JOB,
} from "../../../queue/booking.queue";
import type { BulkAssignPayload, BulkAssignResult } from "./booking.bulkAssign";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enums/user";
import {
  applyServerFare,
  fareAfterChargeOutcome,
  getTripPrice,
  handlePayment,
  pendingBookingNotificationCopy,
  presentBookingForViewer,
  presentBookingsForViewer,
  toBookingErrorMessage,
} from "./booking.utils";
import {
  assertContractRulesBeforePrice,
  assertMaxMilesAfterQuote,
  companionChargeFor,
} from "./booking.contractRules";
import { toMoney } from "./pricing/tripPricing";
import {
  notifyAdmins,
  sendNotifications,
  sendPushNotification,
} from "../../../helpers/notificationsHelper";

import { Driverrating } from "../driverrating/driverrating.model";
import {
  buildApprovedBookingFilter,
  buildPendingBookingFilter,
  buildTripHistoryFilter,
} from "./booking.query";
import {
  LOCKED_FARE_FIELDS,
  NO_SHOW_FROM_STATUSES,
  STAFF,
} from "./booking.constant";
import {
  getExportableTripColumns,
  TripHistoryBooking,
  tripHistoryTable,
} from "./booking.export";
import {
  exportTypeFromQuery,
  writeTabularExport,
} from "../../../shared/tabularExport";
import { runExportJob } from "../../../helpers/runExportJob";
import { EXPORT_TRIP_HISTORY_JOB } from "../../../queue/export.queue";
import {
  collectSystemLogChanges,
  SystemLogServices,
} from "../systemLog/systemLog.service";
import { isDriverOnDuty } from "../driverduty/driverduty.cache";
import { pickupAppointmentError } from "../appApi/apiBooking/booking.helper";
import { County } from "../serviceAndTariff/counties/counties.model";

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
  const actor = await User.findById(user.id).select("role").lean();

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
  const bookingExtras = payload as IBooking & {
    countyId?: string;
    adminOverride?: boolean;
    adminOverrideReason?: string;
    actualGpsMileage?: number;
  };
  const rules = await assertContractRulesBeforePrice({
    pickup: payload.pickupLocation as [number, number],
    dropoff: payload.dropOffLocation as [number, number],
    stop: payload.stopAddress?.length
      ? (payload.stopAddress as [number, number])
      : undefined,
    countyId: bookingExtras.countyId?.toString(),
    userId: riderId,
    serviceDate: payload.serviceDate,
    tripReason: payload.tripReason,
    passengerSeats: payload.passengerSeats,
    adminOverride: bookingExtras.adminOverride,
    adminOverrideReason: bookingExtras.adminOverrideReason,
  });
  const quote = await getTripPrice({
    pickup: payload.pickupLocation as [number, number],
    dropoff: payload.dropOffLocation as [number, number],
    stop: payload.stopAddress?.length
      ? (payload.stopAddress as [number, number])
      : undefined,
    countyId: bookingExtras.countyId?.toString() ?? String(rules.county._id),
    userId: riderId,
    tripType: payload.tripType,
    mobilityRequirements: payload.mobilityRequirements?.toString(),
    serviceDate: payload.serviceDate,
    actualGpsMileage: bookingExtras.actualGpsMileage,
  });
  assertMaxMilesAfterQuote({
    county: rules.county,
    zone: quote.zone,
    tripReason: payload.tripReason,
    billingMileage: quote.billingMileage,
    adminOverride: bookingExtras.adminOverride,
    adminOverrideReason: bookingExtras.adminOverrideReason,
    priorViolations: rules.violations,
  });
  const companionFee = companionChargeFor(
    rules.county,
    payload.passengerSeats,
  );
  if (companionFee > 0) {
    quote.fundingSourceCharge = toMoney(
      quote.fundingSourceCharge + companionFee,
    );
    quote.organizationContribution = quote.fundingSourceCharge;
    quote.totalPrice = toMoney(
      quote.organizationContribution + quote.passengerCoPay,
    );
  }
  payload.countyId = rules.county._id;
  // Store the payer on the booking itself so reads never need County.payersId.
  if (!payload.payerSource && rules.county.payersId) {
    payload.payerSource = new Types.ObjectId(String(rules.county.payersId));
  }
  applyServerFare(payload, quote);

  const notifyAdminOfPendingBooking = async (referenceId: string) => {
    if (actor?.role === USER_ROLES.SUPER_ADMIN) return;
    const rider = await User.findById(payload.userId)
      .select("firstName middleName lastName")
      .lean();
    const copy = pendingBookingNotificationCopy(rider, payload);
    await notifyAdmins({
      sender: user.id,
      text: copy.text,
      description: copy.description,
      referenceId,
    });
  };

  if (!payload.recurringBooking) {
    const created = await Booking.create(payload);
    await notifyAdminOfPendingBooking(created._id.toString());
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
    await notifyAdminOfPendingBooking(recurringBatchId);
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

  const { serviceDate: _serviceDate, ...restQuery } = query;

  const qb = new QueryBuilder(
    Booking.find({
      ...mine,
      serviceDate: { $gte: format(new Date(), "yyyy-MM-dd") },
      bookingStatus: { $nin: ["completed", "cancelled", "no-show"] },
    }),
    restQuery,
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

  const qb = new QueryBuilder(Booking.find(bookingFilter), safeQuery)
    .filter()
    .sort()
    .paginate()
    .populate(["userId", "driverId", "mobilityRequirements", "payerSource"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile contact",
      mobilityRequirements: "name price icon",
      payerSource: "name type",
    });
  qb.modelQuery = qb.modelQuery.populate([
    {
      path: "countyId",
      select: "name programName",
    },
  ]);

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

  if (unassign !== undefined && String(unassign).trim() !== "") {
    const isUnassigned = String(unassign).toLowerCase() === "true";
    bookingFilter.driverId = isUnassigned
      ? { $in: [null] }
      : { $exists: true, $ne: null };
  }

  const qb = new QueryBuilder(Booking.find(bookingFilter), restQuery)
    .filter()
    .sort();
  qb.modelQuery = qb.modelQuery.populate([
    { path: "userId", select: "firstName lastName middleName profile" },
    { path: "mobilityRequirements", select: "name price icon" },
    { path: "driverId", select: "firstName lastName middleName" },
    { path: "payerSource", select: "name type" },
    {
      path: "countyId",
      select: "name programName",
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
    startDate: _startDate,
    endDate: _endDate,
    selectedDate: _selectedDate,
    selectedDates: _selectedDates,
    date: _date,
    from: _from,
    to: _to,
    ids: _ids,
    bookingIds: _bookingIds,
    tripIds: _tripIds,
    selectedIds: _selectedIds,
    fields: _fields,
    selectedFields: _selectedFields,
    columns: _columns,
    driverId: _driverId,
    countyId: _countyId,
    // Old payer filters are ignored (trips are filtered by county now).
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

  qb.modelQuery.populate([
    {
      path: "countyId",
      select: "name programName",
    },
  ]);

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  return {
    data: presentBookingsForViewer(data, _user.role),
    meta,
  };
};

export const buildTripHistoryFile = async (
  role: string | undefined,
  query: Record<string, any>,
) => {
  const bookingFilter = await buildTripHistoryFilter(query);
  if (String(query.unassign ?? "").toLowerCase() === "true") {
    bookingFilter.driverId = { $in: [null] };
  }
  const bookings = await Booking.find(bookingFilter)
    .sort(query.sort || "-serviceDate")
    .populate([
      { path: "userId", select: "firstName lastName" },
      { path: "driverId", select: "firstName lastName" },
      { path: "mobilityRequirements", select: "name" },
      { path: "payerSource", select: "name type" },
      {
        path: "countyId",
        select: "name programName",
      },
    ])
    .lean();

  const selectedFields =
    query.fields ?? query.selectedFields ?? query.columns;

  return writeTabularExport({
    format: exportTypeFromQuery(query),
    ...tripHistoryTable(bookings as TripHistoryBooking[], role, selectedFields),
  });
};

const getTripHistoryExportFields = (user: JwtPayload) =>
  getExportableTripColumns(user.role);

const getTripHistoryInExcelFromDB = (
  user: JwtPayload,
  query: Record<string, any>,
) =>
  runExportJob(EXPORT_TRIP_HISTORY_JOB, {
    role: user.role,
    query,
  });

// update booking
const PRICING_INPUTS = [
  "pickupLocation",
  "dropOffLocation",
  "stopAddress",
  "tripType",
  "mobilityRequirements",
  "serviceDate",
  "actualGpsMileage",
  "countyId",
] as const;

/**
 * No-show (PDF §41): driver arrived, passenger did not appear.
 * - Riders cannot mark it.
 * - A driver can only mark their own trip, and only after tapping "arrived".
 * - Staff (admin/dispatcher) can mark it without the arrival check.
 * - Only before pickup (assigned / confirmed / in-progress), and a reason is required.
 */
const assertCanMarkNoShow = (
  existing: IBooking,
  payload: Partial<IBooking>,
  user: JwtPayload,
) => {
  if (user.role === USER_ROLES.USER) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "Riders cannot mark a trip as no-show.",
    );
  }
  if (
    !(NO_SHOW_FROM_STATUSES as readonly string[]).includes(
      existing.bookingStatus,
    )
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `A ${existing.bookingStatus} trip cannot be marked as no-show.`,
    );
  }
  if (user.role === USER_ROLES.DRIVER) {
    if (String(existing.driverId) !== String(user.id)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You are not the driver of this trip.",
      );
    }
    if (!existing.driverArrivedAt) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Mark yourself as arrived before marking the passenger as no-show.",
      );
    }
  }
  if (!payload.noShowReason?.trim()) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "A reason is required to mark a trip as no-show.",
    );
  }
};

const updateBookingInDB = async (
  id: string,
  payload: IBooking,
  user: JwtPayload,
) => {
  if (payload.driverId) {
    const onDuty = await isDriverOnDuty(String(payload.driverId));
    if (!onDuty) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "This driver is currently off duty. Please assign another driver who is on duty.",
      );
    }
  }

  for (const key of LOCKED_FARE_FIELDS) {
    delete payload[key];
  }

  if (payload.bookingStatus === "confirmed") {
    payload.driverArrivedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  }
  if (payload.bookingStatus === "trip-started") {
    payload.driverPicupAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  }

  const existing = await Booking.findById(id);
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Riders/drivers may only update their own trip, and can't move it to
  // another rider/driver or approve it themselves.
  if (!STAFF.has(user.role)) {
    const ownerField = user.role === USER_ROLES.DRIVER ? "driverId" : "userId";
    if (String(existing[ownerField] ?? "") !== String(user.id)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can only update your own booking",
      );
    }
    delete (payload as Partial<IBooking>).userId;
    delete (payload as Partial<IBooking>).driverId;
    delete (payload as Partial<IBooking>).isApproved;
  }

  // Server-set no-show audit fields; clients may only send noShowReason.
  delete payload.noShowAt;
  delete payload.noShowBy;

  // A no-show is closed: only staff may change it afterwards.
  if (existing.bookingStatus === "no-show" && !STAFF.has(user.role)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "This trip is marked as no-show. Contact dispatch to change it.",
    );
  }

  const isNoShow = payload.bookingStatus === "no-show";
  if (isNoShow) {
    assertCanMarkNoShow(existing, payload, user);
    payload.noShowReason = payload.noShowReason?.trim();
    payload.noShowAt = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    payload.noShowBy = new Types.ObjectId(user.id);
  } else if (payload.bookingStatus !== undefined) {
    delete payload.noShowReason;
  }

  if (payload.bookingStatus === "completed") {
    const payment = await handlePayment(id);
    const paymentBooking = payment.booking as unknown as Record<
      string,
      unknown
    >;
    const changes = collectSystemLogChanges(
      existing.toObject() as unknown as Record<string, unknown>,
      paymentBooking,
      ["bookingStatus", "paymentStatus", "stripeCheckoutSessionId"],
    );
    await SystemLogServices.createSystemLogIntoDB({
      actor: user,
      action: "UPDATE",
      module: "booking",
      entityType: "Booking",
      entityId: id,
      description: `Updated booking ${id}`,
      changes,
    });
    return {
      checkoutUrl: payment.checkoutUrl,
      paymentStatus: payment.booking.paymentStatus,
    };
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

  /**
   * PREVIOUS IMPLEMENTATION
   * No-show was only `bookingStatus: "cancelled"` + `isNoShow: true`, so it was
   * saved as cancelled and could not be told apart in reports. That request
   * still works; `bookingStatus: "no-show"` now uses the same charge rules and
   * the funding source's noShow outcome.
   */
  if (payload.bookingStatus === "cancelled" || isNoShow) {
    // Old clients: "cancelled" + isNoShow/noShow flag means a no-show charge.
    const chargeAsNoShow =
      isNoShow ||
      Boolean(
        (payload as { isNoShow?: boolean }).isNoShow ??
          (payload as { noShow?: boolean }).noShow,
      );
    const outcome = chargeAsNoShow
      ? (existing.noShowOutcome ?? "both")
      : (payload.cancellationOutcome ?? existing.cancellationOutcome ?? "both");

    // FS share only — do not fall back to totalPrice (that is org + copay).
    let fundingSourceCharge =
      payload.organizationContribution ??
      existing.organizationContribution ??
      0;
    let passengerCopay =
      payload.passengerCoPay ?? existing.passengerCoPay ?? 0;

    const countyId = (
      existing as IBooking & { countyId?: Types.ObjectId }
    ).countyId;
    if (countyId) {
      const county = await County.findById(countyId)
        .select("cancellationNoShow")
        .lean();
      const fees = county?.cancellationNoShow;
      if (fees) {
        if (chargeAsNoShow) {
          if (fees.noShowPassenger != null) {
            passengerCopay = fees.noShowPassenger;
          }
          if (fees.noShowFundingSource != null) {
            fundingSourceCharge = fees.noShowFundingSource;
          }
        } else {
          const windowHrs = fees.freeCancellationWindowHours ?? 2;
          const pickupMs = Date.parse(
            `${existing.serviceDate}T${existing.pickupTime || "00:00"}`,
          );
          const hoursBefore =
            Number.isFinite(pickupMs) && !Number.isNaN(pickupMs)
              ? (pickupMs - Date.now()) / (1000 * 60 * 60)
              : null;
          const freeCancel =
            hoursBefore != null && hoursBefore >= windowHrs;
          if (freeCancel) {
            passengerCopay = 0;
            fundingSourceCharge = 0;
          } else {
            if (fees.lateCancellationPassenger != null) {
              passengerCopay = fees.lateCancellationPassenger;
            }
            if (fees.lateCancellationFundingSource != null) {
              fundingSourceCharge = fees.lateCancellationFundingSource;
            }
          }
        }
      }
    }

    const adjusted = fareAfterChargeOutcome(
      fundingSourceCharge,
      passengerCopay,
      outcome,
    );
    if (passengerCopay > 0 && existing.paymentStatus === "paid") {
      adjusted.paymentStatus = "paid";
    }
    Object.assign(payload, adjusted);
    if (!isNoShow) payload.cancelledBy = new Types.ObjectId(user.id);
  }

  const booking = await Booking.findByIdAndUpdate(id, payload, { new: true });
  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }
  const changes = collectSystemLogChanges(
    existing.toObject() as unknown as Record<string, unknown>,
    booking.toObject() as unknown as Record<string, unknown>,
    Object.keys(payload),
  );
  await SystemLogServices.createSystemLogIntoDB({
    actor: user,
    action: "UPDATE",
    module: "booking",
    entityType: "Booking",
    entityId: booking._id.toString(),
    description: `Updated booking ${booking._id.toString()}`,
    changes,
  });
  const userData = await User.findById(booking.userId).select(
    "firstName lastName role",
  );
  const actorId = user.id?.toString();
  const recipientIds = [booking.userId, booking.driverId]
    .map((id) => id?.toString())
    .filter((id): id is string => Boolean(id) && id !== actorId);

  await sendPushNotification({
    userIds: recipientIds,
    title: isNoShow
      ? "Trip marked as no-show"
      : `${userData?.firstName} ${userData?.lastName} ${booking.bookingStatus} your trip`,
    body: isNoShow
      ? `Reason: ${booking.noShowReason ?? "Passenger did not show up"}`
      : `${booking.bookingStatus} your trip`,
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
    ? ratings.reduce((sum, row) => sum + row?.rating, 0) / ratings.length
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
  tripType: "one-way" | "round-trip" = "one-way",
  mobilityRequirements?: string,
  countyId?: string,
  userId?: string,
  serviceDate?: string,
  actualGpsMileage?: number,
  tripReason?: string,
  passengerSeats?: number,
  adminOverride?: boolean,
  adminOverrideReason?: string,
) => {
  const rules = await assertContractRulesBeforePrice({
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    stop: stopAddress,
    countyId,
    userId,
    serviceDate,
    tripReason,
    passengerSeats,
    adminOverride,
    adminOverrideReason,
  });
  const quote = await getTripPrice({
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    stop: stopAddress,
    countyId: countyId ?? String(rules.county._id),
    userId,
    tripType,
    mobilityRequirements,
    serviceDate,
    actualGpsMileage,
  });
  assertMaxMilesAfterQuote({
    county: rules.county,
    zone: quote.zone,
    tripReason,
    billingMileage: quote.billingMileage,
    adminOverride,
    adminOverrideReason,
    priorViolations: rules.violations,
  });
  const companionFee = companionChargeFor(rules.county, passengerSeats);
  if (companionFee > 0) {
    quote.fundingSourceCharge = toMoney(
      quote.fundingSourceCharge + companionFee,
    );
    quote.organizationContribution = quote.fundingSourceCharge;
    quote.totalPrice = toMoney(
      quote.organizationContribution + quote.passengerCoPay,
    );
  }
  return quote;
};

// Random bulk assign runs on the booking worker (see booking.bulkAssign.ts).
const bulkAssignDriversInDB = async (
  user: JwtPayload,
  payload: BulkAssignPayload,
) => {
  try {
    await bookingQueueEvents.waitUntilReady();
    const job = await bookingQueue.add(
      BULK_ASSIGN_DRIVERS_JOB,
      { actor: { id: user.id, role: user.role, email: user.email }, payload },
      { attempts: 1 },
    );
    return (await job.waitUntilFinished(
      bookingQueueEvents,
      JOB_WAIT_MS,
    )) as BulkAssignResult;
  } catch (error) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      error instanceof Error ? error.message : "Bulk assign failed",
    );
  }
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
  getTripHistoryExportFields,
  bulkAssignDriversInDB,
};
