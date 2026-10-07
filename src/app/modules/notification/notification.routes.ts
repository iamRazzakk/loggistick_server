import express from "express";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
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
    checkDispatcherRoute("/notifications"),
    NotificationController.createNotification,
  )
  .get(
    auth(
      USER_ROLES.USER,
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DRIVER,
      USER_ROLES.DISPATCHER,
    ),
    checkDispatcherRoute("/notifications"),
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
    checkDispatcherRoute("/notifications"),
    NotificationController.readNotification,
  );
export const NotificationRoutes = router;
