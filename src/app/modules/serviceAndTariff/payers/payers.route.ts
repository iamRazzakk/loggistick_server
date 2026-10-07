import express from "express";
import auth from "../../../middlewares/auth";
import checkDispatcherRoute from "../../../middlewares/checkDispatcherRoute";
import validateRequest from "../../../middlewares/validateRequest";
import { USER_ROLES } from "../../../../enums/user";
import { PayersController } from "./payers.controller";
import { PayersValidations } from "./payers.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/finance"),
    validateRequest(PayersValidations.createPayersZodSchema),
    PayersController.createPayers,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.USER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/finance"),
    PayersController.getAllPayers,
  );

router
  .route("/admin")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/finance"),
    PayersController.getAllPayersForAdmin,
  );

router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.USER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/finance"),
    PayersController.getSinglePayers,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/finance"),
    validateRequest(PayersValidations.updatePayersZodSchema),
    PayersController.updatePayers,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/finance"),
    PayersController.deletePayers,
  );

export const PayersRoutes = router;
