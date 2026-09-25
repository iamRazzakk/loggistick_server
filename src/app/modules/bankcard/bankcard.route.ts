import express from "express";
import { BankcardController } from "./bankcard.controller";
import auth from "../../middlewares/auth";
import { USER_ROLES } from "../../../enums/user";

const router = express.Router();
router
  .route("/")
  .post(
    auth(USER_ROLES.USER, USER_ROLES.SUPER_ADMIN),
    BankcardController.createBankCard,
  )
  .get(
    auth(USER_ROLES.USER, USER_ROLES.SUPER_ADMIN),
    BankcardController.getBankCard,
  );

export const BankcardRoutes = router;
