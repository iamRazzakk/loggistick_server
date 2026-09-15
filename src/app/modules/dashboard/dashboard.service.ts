import { format } from "date-fns";
import { USER_ROLES } from "../../../enums/user";
import QueryBuilder from "../../builder/queryBuilder";
import { Booking } from "../booking/booking.model";
import { User } from "../user/user.model";
import { DASHBOARD_SEARCHABLE_FIELDS } from "./dashboard.constants";

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

export const DashboardServices = {
  dashboardOverviewFromDB,
  activeTripsFromDB,
  pendingTripsFromDB,
};
