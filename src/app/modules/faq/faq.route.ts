import express from "express";
import { FaqController } from "./faq.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";
import validateRequest from "../../middlewares/validateRequest";
import { FaqValidations } from "./faq.validation";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(FaqValidations.createFaqZodSchema),
    FaqController.createFaq,
  )
  .get(
    FaqController.getAllFaqs,
  );

router
  .route("/:id")
  .patch(
    auth(USER_ROLES.SUPER_ADMIN),
    validateRequest(FaqValidations.updateFaqZodSchema),
    FaqController.updateFaq,
  )
  .delete(auth(USER_ROLES.SUPER_ADMIN), FaqController.deleteFaq);

export const FaqRoutes = router;
