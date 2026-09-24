import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  getSingleFilePath,
  getUploadFields,
} from "../../middlewares/fileUploaderHandlar";
import { parseRequestBody } from "../../middlewares/parseBody";
import { parseBody } from "../../../util/parse";

const router = express.Router();

router.get(
  "/profile",
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.DISPATCHER,
    USER_ROLES.USER,
    USER_ROLES.DRIVER,
  ),
  UserController.getUserProfile,
);

router
  .route("/")
  .post(
    getUploadFields(),
    parseRequestBody(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const data = req.body;
        const licenseImage = getSingleFilePath(
          req.files as Record<string, Express.Multer.File[]>,
          "image",
        );

        if (licenseImage) {
          req.body.driverData = {
            ...req.body.driverData,
            licenseImage,
          };
        }
        req.body = parseBody(data);
        next();
      } catch (error) {
        next(error);
      }
    },
    // validateRequest(UserValidation.createUserZodSchema),
    UserController.createUser,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER, USER_ROLES.USER),
    getUploadFields(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const data = req.body;
        const profilePath = getSingleFilePath(
          req.files as Record<string, Express.Multer.File[]>,
          "image",
        );
        if (profilePath) {
          data.profile = profilePath;
        }
        // need to parse the body
        const parsedBody = JSON.parse(data);
        req.body = parsedBody;
        next();
      } catch (error) {
        next(error);
      }
    },
    UserController.updateProfile,
  );

router
  .route("/drivers")
  .get(auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER), UserController.getAllDrivers);

router
  .route("/riders")
  .get(auth(USER_ROLES.SUPER_ADMIN), UserController.getAllRiders);

router
  .route("/driver-applications")
  .get(auth(USER_ROLES.SUPER_ADMIN), UserController.getAllDriverApplications);

export const UserRoutes = router;
