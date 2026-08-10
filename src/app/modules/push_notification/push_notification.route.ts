import express from "express";
import { PushNotificationController } from "./push_notification.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { PushNotificationValidations } from "./push_notification.validation";

const router = express.Router();

router.post(
  "/",
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(PushNotificationValidations.createPushNotificationZodSchema),
  PushNotificationController.createPushNotification,
);
router.get(
  "/",
  auth(USER_ROLES.SUPER_ADMIN),
  PushNotificationController.getAllPushNotifications,
);

export const PushNotificationRoutes = router;
