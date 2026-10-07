import express from "express";
import { USER_ROLES } from "../../../enums/user";
import { notificationLimiter } from "../../../services/rate-limiter";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { BroadcastNotificationController } from "./broadcast.controller";
import { BroadcastValidation } from "./broadcast.validation";

const router = express.Router();

router.post(
  "/send",
  notificationLimiter,
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(BroadcastValidation.sendBroadcastZodSchema),
  BroadcastNotificationController.sendBroadcast,
);

router.get(
  "/",
  auth(USER_ROLES.SUPER_ADMIN),
  BroadcastNotificationController.getBroadcasts,
);

export const BroadcastNotificationRoutes = router;
