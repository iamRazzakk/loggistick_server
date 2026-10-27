import express from "express";
import { DashboardController } from "./dashboard.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";

const router = express.Router();

router.get(
  "/statistics",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  DashboardController.dashboardOverview,
);

router.get(
  "/active-trips",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  DashboardController.activeTrips,
);
router.get(
  "/pending-trips",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  DashboardController.pendingTrips,
);
router.get(
  "/admin/trip-distribution",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  DashboardController.getAdminTripDistribution,
);
router.get(
  "/admin/dashboard-overview",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  DashboardController.getAdminDashboardOverview,
);
router.get(
  "/rider/trip-history/:id",
  auth(USER_ROLES.DISPATCHER, USER_ROLES.SUPER_ADMIN),
  checkDispatcherRoute("/riders"),
  DashboardController.getRiderAndUserTripHistory,
);
export const DashboardRoutes = router;
