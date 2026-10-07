import express from "express";
import { VehicleController } from "./vehicle.controller";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { VehicleValidations } from "./vehicle.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(VehicleValidations.createVehicleZodSchema),
    VehicleController.createVehicle,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/fleet"),
    VehicleController.getAllVehicles,
  );
router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
      USER_ROLES.USER,
    ),
    checkDispatcherRoute("/fleet/:id"),
    VehicleController.getSingleVehicle,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(VehicleValidations.updateVehicleZodSchema),
    VehicleController.updateVehicle,
  )
  .delete(auth(USER_ROLES.SUPER_ADMIN), VehicleController.deleteVehicle);

export const VehicleRoutes = router;
