import express from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import validateRequest from "../../middlewares/validateRequest";
import { DriverDutyController } from "./driverduty.controller";
import { DriverDutyValidations } from "./driverduty.validation";

const router = express.Router();

router
  .route("/")
  .post(auth(USER_ROLES.DRIVER), DriverDutyController.toggleDuty)
  .get(auth(USER_ROLES.DRIVER), DriverDutyController.getCurrentDuty);

router.route("/history").get(
  auth(USER_ROLES.DRIVER),
  validateRequest(DriverDutyValidations.getDutyLogsZodSchema),
  DriverDutyController.getMyDutyHistory,
);

router.route("/logs").get(
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  checkDispatcherRoute("/drivers"),
  validateRequest(DriverDutyValidations.getDutyLogsZodSchema),
  DriverDutyController.getDutyLogs,
);

export const DriverDutyRoutes = router;
