import express from "express";
import { UserManagementController } from "./user-management.controller";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router.post(
  "/",
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
  checkDispatcherRoute("/riders"),
  UserManagementController.createUserManagement,
);

export const UserManagementRoutes = router;
