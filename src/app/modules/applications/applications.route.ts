import express from "express";
import { ApplicationsController } from "./applications.controller";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";

const router = express.Router();

router.get(
  "/drivers",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  checkDispatcherRoute("/drivers"),
  ApplicationsController.getAllDriver,
);
router.patch(
  "/:id",
  auth(USER_ROLES.SUPER_ADMIN),
  ApplicationsController.updateDriverApplicationsStatus,
);

export const ApplicationsRoutes = router;
