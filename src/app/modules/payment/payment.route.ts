import express from "express";
import { PaymentController } from "./payment.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router.get("/", auth(USER_ROLES.SUPER_ADMIN), PaymentController.getAllPayments);
router.get(
  "/overview",
  auth(USER_ROLES.SUPER_ADMIN),
  PaymentController.getPaymentOverView,
);
router.get(
  "/export",
  auth(USER_ROLES.SUPER_ADMIN),
  PaymentController.exportAllPaymentsDataInExcelFormat,
);
export const PaymentRoutes = router;
