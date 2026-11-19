import { format } from "date-fns";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";
import { County } from "../serviceAndTariff/counties/counties.model";
import { countyIdsFromQuery } from "../booking/booking.query";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAllBookingScheduledTodayFromDB = async (
  query: Record<string, any>,
) => {
  const { date, serviceDate, searchTerm, countyId, ...restQuery } = query;
  const targetDate =
    (date as string) ||
    (serviceDate as string) ||
    format(new Date(), "yyyy-MM-dd");

  // Filter by county: ?countyId=<id>[,<id>] and/or ?searchTerm=<county name>.
  const filter: Record<string, unknown> = { serviceDate: targetDate };
  const countyIds = countyIdsFromQuery(countyId);
  const term = String(searchTerm ?? "").trim();
  if (term) {
    const matched = await County.find({
      $or: [
        { name: { $regex: escapeRegex(term), $options: "i" } },
        { programName: { $regex: escapeRegex(term), $options: "i" } },
      ],
    })
      .select("_id")
      .lean();
    const byName = matched.map((county) => county._id);
    filter.countyId = {
      $in: countyIds.length
        ? byName.filter((id) => countyIds.some((c) => c.equals(id)))
        : byName,
    };
  } else if (countyIds.length) {
    filter.countyId = { $in: countyIds };
  }

  const qb = new QueryBuilder(Booking.find(filter), restQuery)
    .filter()
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
