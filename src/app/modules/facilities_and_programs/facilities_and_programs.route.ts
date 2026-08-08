import express from "express";
import { FacilitiesAndProgramsController } from "./facilities_and_programs.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { FacilitiesAndProgramsValidations } from "./facilities_and_programs.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(
      FacilitiesAndProgramsValidations.createFacilitiesAndProgramsZodSchema,
    ),
    FacilitiesAndProgramsController.createFacilitiesAndPrograms,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    FacilitiesAndProgramsController.getAllFacilitiesAndPrograms,
  );

router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    FacilitiesAndProgramsController.getSingleFacilitiesAndPrograms,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(
      FacilitiesAndProgramsValidations.updateFacilitiesAndProgramsZodSchema,
    ),
    FacilitiesAndProgramsController.updateFacilitiesAndPrograms,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN),
    FacilitiesAndProgramsController.deleteFacilitiesAndPrograms,
  );

export const FacilitiesAndProgramsRoutes = router;
