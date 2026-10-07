import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import { UserController } from "./user.controller";
import auth from "../../middlewares/auth";
import checkDispatcherRoute from "../../middlewares/checkDispatcherRoute";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";
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
  checkDispatcherRoute("/profile"),
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
    checkDispatcherRoute("/profile"),
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
        req.body = parseBody(data);
        next();
      } catch (error) {
        next(error);
      }
    },
    UserController.updateProfile,
  );

// dispatcher
router
  .route("/dispatcher")
  .post(auth(USER_ROLES.SUPER_ADMIN), UserController.createDispatcherAsAdmin)
  .get(auth(USER_ROLES.SUPER_ADMIN), UserController.getAllDispatchers);

router.patch(
  "/dispatcher/:id/routes",
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.updateDispatcherRoutesZodSchema),
  UserController.updateDispatcherRoutes,
);

router
  .route("/drivers")
  .get(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.USER),
    UserController.getAllDrivers,
  );

router
  .route("/riders")
  .get(auth(USER_ROLES.SUPER_ADMIN), UserController.getAllRiders);

router
  .route("/driver-applications")
  .get(auth(USER_ROLES.SUPER_ADMIN), UserController.getAllDriverApplications);

export const UserRoutes = router;
