import express from "express";
import { PaymentController } from "./payment.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();

router.get("/", auth(USER_ROLES.SUPER_ADMIN), PaymentController.getAllPayments);

export const PaymentRoutes = router;
