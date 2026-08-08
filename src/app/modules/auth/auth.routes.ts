import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";
import { authLimiter } from "../../../services/rate-limiter";
// import passport from '../../../config/passport'
const router = express.Router();

router.post(
  "/login",
  authLimiter,
  validateRequest(AuthValidation.createLoginZodSchema),
  AuthController.loginUser,
);

router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(AuthValidation.createForgetPasswordZodSchema),
  AuthController.forgetPassword,
);

router.post("/refresh-token", authLimiter, AuthController.newAccessToken);

router.post(
  "/resend-otp",
  authLimiter,
  validateRequest(AuthValidation.createResendOtpZodSchema),
  AuthController.resendVerificationEmail,
);

router.post(
  "/verify-email",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, oneTimeCode } = req.body;

      req.body = { email, oneTimeCode: Number(oneTimeCode) };
      next();
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Failed to convert string to number" });
    }
  },
  validateRequest(AuthValidation.createVerifyEmailZodSchema),
  AuthController.verifyEmail,
);

router.post(
  "/reset-password",
  authLimiter,
  validateRequest(AuthValidation.createResetPasswordZodSchema),
  AuthController.resetPassword,
);

router.post(
  "/change-password",
  authLimiter,
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.USER,
    USER_ROLES.DRIVER,
    USER_ROLES.DISPATCHER,
  ),
  validateRequest(AuthValidation.createChangePasswordZodSchema),
  AuthController.changePassword,
);

router.delete(
  "/delete-account",
  auth(USER_ROLES.SUPER_ADMIN),
  AuthController.deleteUser,
);

export const AuthRoutes = router;
