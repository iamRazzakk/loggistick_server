import express from "express";
import { ContuctDispatcherController } from "./contuctDispatcher.controller";
import auth from "../../../middlewares/auth";
import { USER_ROLES } from "../../../../enums/user";
const router = express.Router();
router
  .route("/")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.USER,
    ),
    ContuctDispatcherController.contuctDispatcher,
  );
export const ContuctDispatcherRoutes = router;
