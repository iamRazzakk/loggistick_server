import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLES } from "../../../enums/user";
import { EmergencyContactController } from "./emergency_contact.controller";
import { EmergencyContactValidations } from "./emergency_contact.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    validateRequest(EmergencyContactValidations.createEmergencyContactZodSchema),
    EmergencyContactController.createEmergencyContact,
  )
  .get(
    auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
    EmergencyContactController.getEmergencyContact,
  );

export const EmergencyContactRoutes = router;
