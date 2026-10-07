import express from "express";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLES } from "../../../enums/user";
import { ReportsController } from "./reports.controller";
import { ReportsValidations } from "./reports.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/reports"),
    validateRequest(ReportsValidations.createReportZodSchema),
    ReportsController.createReport,
  )
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/reports"),
    ReportsController.getAllReports,
  );

router
  .route("/my")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/reports"),
    ReportsController.getMyReports,
  );

router
  .route("/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/reports"),
    ReportsController.getReportById,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/reports"),
    validateRequest(ReportsValidations.updateReportZodSchema),
    ReportsController.updateReport,
  )
  .delete(auth(USER_ROLES.SUPER_ADMIN), ReportsController.deleteReport);

export const ReportsRoutes = router;
