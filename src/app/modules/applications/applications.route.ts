import express from "express";
import { ApplicationsController } from "./applications.controller";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";

const router = express.Router();

router.patch(
  "/:id",
  auth(USER_ROLES.SUPER_ADMIN),
  ApplicationsController.updateDriverApplicationsStatus,
);

router.get(
  "/drivers",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  ApplicationsController.getAllDriver,
);

export const ApplicationsRoutes = router;
