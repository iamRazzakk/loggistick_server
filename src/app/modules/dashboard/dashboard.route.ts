import express from "express";
import { DashboardController } from "./dashboard.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router.get(
  "/statistics",
  auth(USER_ROLES.SUPER_ADMIN),
  DashboardController.dashboardOverview,
);
router.get(
  "/active-trips",
  auth(USER_ROLES.SUPER_ADMIN),
  DashboardController.activeTrips,
);
router.get(
  "/pending-trips",
  auth(USER_ROLES.SUPER_ADMIN),
  DashboardController.pendingTrips,
);
router.get(
  "/admin/trip-distribution",
  auth(USER_ROLES.SUPER_ADMIN),
  DashboardController.getAdminTripDistribution,
);
router.get(
  "/admin/dashboard-overview",
  auth(USER_ROLES.SUPER_ADMIN),
  DashboardController.getAdminDashboardOverview,
);
export const DashboardRoutes = router;
