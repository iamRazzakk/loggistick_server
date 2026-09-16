import { format } from "date-fns";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";

const getAllBookingScheduledTodayFromDB = async (
  query: Record<string, any>,
) => {
  const { date, serviceDate, ...restQuery } = query;
  const targetDate =
    (date as string) ||
    (serviceDate as string) ||
    format(new Date(), "yyyy-MM-dd");
  const qb = new QueryBuilder(
    Booking.find({ serviceDate: targetDate }),
    restQuery,
  )
    .filter()
    .search(["payerSource"])
    .paginate()
    .populate(["userId", "driverId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
    });
  const [meta, data] = await Promise.all([
    qb.getPaginationInfo(),
    qb.modelQuery.exec(),
  ]);
  return { meta, data };
};

// today scheduled trips onboarding
const getTodayScheduledTripsOnboardingFromDB = async () => {
  const [
    todayTotalTrips,
    todayAssignedStatusTrips,
    todayInProgressStatusTrips,
    todayCompletedStatusTrips,
    todayCancelledStatusTrips,
  ] = await Promise.all([
    Booking.countDocuments({
      serviceDate: format(new Date(), "yyyy-MM-dd"),
    })
      .lean()
      .exec(),
    Booking.countDocuments({
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: "assigned",
    })
      .lean()
      .exec(),
    Booking.countDocuments({
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: "in-progress",
    })
      .lean()
      .exec(),
    Booking.countDocuments({
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: "completed",
    })
      .lean()
      .exec(),
    Booking.countDocuments({
      serviceDate: format(new Date(), "yyyy-MM-dd"),
      bookingStatus: "cancelled",
    })
      .lean()
      .exec(),
  ]);

  return {
    todayTotalTrips,
    todayAssignedStatusTrips,
    todayInProgressStatusTrips,
    todayCompletedStatusTrips,
    todayCancelledStatusTrips,
  };
};





export const ScheduledServices = {
  getAllBookingScheduledTodayFromDB,
  getTodayScheduledTripsOnboardingFromDB,
};
