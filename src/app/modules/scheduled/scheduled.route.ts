import express from "express";
import { ScheduledController } from "./scheduled.controller";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";

const router = express.Router();
router
  .route("/schedule")
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    ScheduledController.getAllBookingScheduledToday,
  );
router
  .route("/schedule/onboarding")
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    ScheduledController.getTodayScheduledTripsOnboarding,
  );


export const ScheduledRoutes = router;
