import { Router } from "express";
import { AppApiBookingController } from "./booking.controller";
import auth from "../../../middlewares/auth";
import { USER_ROLES } from "../../../../enums/user";

const router = Router();

router
  .route("/")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    AppApiBookingController.getMyBookingsOnGoingData,
  );

router
  .route("/upcoming")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    AppApiBookingController.getAllUpcomingBookings,
  );
router
  .route("/recent-activity")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    AppApiBookingController.getRecentActivity,
  );

router
  .route("/driver-overview-data")
  .get(
    auth(USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    AppApiBookingController.getDriverOverviewData,
  );

router
  .route("/today")
  .get(
    auth(USER_ROLES.USER),
    AppApiBookingController.getUserOnGoingBookingToday,
  );

router
  .route("/:id")
  .get(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    AppApiBookingController.getMyBookingDetailsData,
  );

export const AppApiBookingRoutes = router;
