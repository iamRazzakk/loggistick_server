import express from "express";
import { VehicleAssignController } from "./vehicleassign.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    VehicleAssignController.createVehicleAssign,
  )
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    VehicleAssignController.getAllVehicleAssigns,
  );

router
  .route("/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    VehicleAssignController.getSingleVehicleAssign,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    VehicleAssignController.updateVehicleAssign,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN),
    VehicleAssignController.deleteVehicleAssign,
  );

export const VehicleAssignRoutes = router;
