import express from "express";
import { FundingSourcesController } from "./funding_sources.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { FundingSourcesValidations } from "./funding_sources.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(FundingSourcesValidations.createFundingSourcesZodSchema),
    FundingSourcesController.createFundingSources,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.USER,
      USER_ROLES.DISPATCHER,
      USER_ROLES.DRIVER,
    ),
    FundingSourcesController.getAllFundingSources,
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
    FundingSourcesController.getSingleFundingSources,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(FundingSourcesValidations.updateFundingSourcesZodSchema),
    FundingSourcesController.updateFundingSources,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN),
    FundingSourcesController.deleteFundingSources,
  );

export const FundingSourcesRoutes = router;