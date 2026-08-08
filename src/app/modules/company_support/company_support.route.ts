import express from "express";
import { CompanySupportController } from "./company_support.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { CompanySupportValidations } from "./company_support.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(CompanySupportValidations.upsertCompanySupportZodSchema),
    CompanySupportController.upsertCompanySupport,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    CompanySupportController.getCompanySupport,
  );

export const CompanySupportRoutes = router;
