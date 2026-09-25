import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import { NotificationController } from "./notification.controller";
const router = express.Router();

router
  .route("/")
  .post(
    auth(
      USER_ROLES.USER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DRIVER,
      USER_ROLES.DISPATCHER,
    ),
    NotificationController.createNotification,
  )
  .get(
    auth(
      USER_ROLES.USER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DRIVER,
      USER_ROLES.DISPATCHER,
    ),
    NotificationController.getNotificationFromDB,
  );

router
  .route("/:id")
  .patch(
    auth(
      USER_ROLES.USER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DRIVER,
      USER_ROLES.DISPATCHER,
    ),
    NotificationController.readNotification,
  );
export const NotificationRoutes = router;
