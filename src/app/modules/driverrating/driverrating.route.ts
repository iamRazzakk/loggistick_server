import express from "express";
import { DriverratingController } from "./driverrating.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router
  .route("/")
  .post(auth(USER_ROLES.SUPER_ADMIN), DriverratingController.createDriverRating)
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    DriverratingController.getAllDriverRatings,
  );

router
  .route("/:id")
  .get(
    auth(USER_ROLES.SUPER_ADMIN),
    DriverratingController.getSingleDriverRating,
  )
  .put(auth(USER_ROLES.SUPER_ADMIN), DriverratingController.updateDriverRating);
export const DriverratingRoutes = router;
