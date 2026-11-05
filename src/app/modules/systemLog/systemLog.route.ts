import express from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import { SystemLogController } from "./systemLog.controller";

const router = express.Router();

router.get(
  "/",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  SystemLogController.getSystemLogs,
);

export const SystemLogRoutes = router;
