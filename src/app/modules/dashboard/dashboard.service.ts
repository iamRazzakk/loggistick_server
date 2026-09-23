import { endOfMonth, format } from "date-fns";
import { USER_ROLES } from "../../../enums/user";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";
import { User } from "../user/user.model";
import { DASHBOARD_SEARCHABLE_FIELDS } from "./dashboard.constants";
import { Vehicle } from "../vehicle/vehicle.model";

const dashboardOverviewFromDB = async () => {
  const today = format(new Date(), "yyyy-MM-dd");

  const [todayTrip, totalUsers, todayCompleted, actionRequired] =
    await Promise.all([
      Booking.countDocuments({ serviceDate: today }),
      User.countDocuments({ role: USER_ROLES.USER }),
      Booking.countDocuments({
        serviceDate: today,
        bookingStatus: "completed",
      }),
      Booking.countDocuments({ bookingStatus: "pending" }),
    ]);

  const successRate =
    todayTrip > 0 ? Number(((todayCompleted / todayTrip) * 100).toFixed(2)) : 0;

  return {
    todayTrip,
    totalUsers,
    successRate,
    actionRequired,
  };
};

const activeTripsFromDB = async (query: Record<string, any>) => {
  const qb = new QueryBuilder(
    Booking.find({
      bookingStatus: { $in: ["assigned", "in-progress"] },
    }),
    query,
  )
    .search(DASHBOARD_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields()
    .populate(["userId", "driverId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
    });

  const [meta, data] = await Promise.all([
    qb.getPaginationInfo(),
    qb.modelQuery.exec(),
  ]);

  return {
    meta,
    data,
  };
};

// pending trips

const pendingTripsFromDB = async (query: Record<string, any>) => {
  const result = await Booking.find({
    bookingStatus: "pending",
    $or: [{ userId: { $ne: null } }, { driverId: { $ne: null } }],
  });

  const uniqueResult = [
    ...new Map(
      result.map((booking: any) => [
        String(booking.userId?._id || booking.userId),
        booking,
      ]),
    ).values(),
  ];

  const qb = new QueryBuilder(
    Booking.find({
      $or: uniqueResult,
    }),
    query,
  )
    .paginate()
    .fields()
    .populate(["userId", "driverId"], {
      userId: "firstName lastName middleName profile",
      driverId: "firstName lastName middleName profile",
    });

  const [meta, data] = await Promise.all([
    qb.getPaginationInfo(),
    qb.modelQuery.exec(),
  ]);

  return {
    meta,
    data,
  };
};

// admin dashboard
const getAdminDashboardOverviewFromDB = async () => {
  // total vehicles, total Driver, total Trip (This month), total Revenue
  const [totalVehicles, totalDrivers, totalTrips] = await Promise.all([
    Vehicle.countDocuments(),
    User.countDocuments({ role: USER_ROLES.DRIVER }),
    Booking.countDocuments({
      serviceDate: {
        $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      },
    }),
  ]);
  const totalRevenue = 0;
  return {
    totalVehicles,
    totalDrivers,
    totalTrips,
    totalRevenue,
  };
};
// trip distribution base on 12 months jan to dec
const getAdminTripDistributionFromDB = async () => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const year = new Date().getFullYear();
  const tripDistribution = await Promise.all(
    months.map(async (month, index) => {
      const start = new Date(year, index, 1);
      const range = {
        $gte: format(start, "yyyy-MM-dd"),
        $lte: format(endOfMonth(start), "yyyy-MM-dd"),
      };
      const [oneWayTrips, roundTripTrips] = await Promise.all([
        Booking.countDocuments({ tripType: "one-way", serviceDate: range }),
        Booking.countDocuments({ tripType: "round-trip", serviceDate: range }),
      ]);
      return { month, oneWayTrips, roundTripTrips };
    }),
  );
  return tripDistribution;
};

export const DashboardServices = {
  dashboardOverviewFromDB,
  activeTripsFromDB,
  pendingTripsFromDB,
  getAdminDashboardOverviewFromDB,
  getAdminTripDistributionFromDB,
};
