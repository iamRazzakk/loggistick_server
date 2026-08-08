import express from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import { RuleController } from "./rule.controller";
const router = express.Router();

router.route("/").post(auth(USER_ROLES.SUPER_ADMIN), RuleController.createRule);

router.route("/:type").get(RuleController.getRule);

export const RuleRoutes = router;
