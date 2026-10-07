import express, { NextFunction, Request, Response } from "express";
import { MobilityController } from "./mobility.controller";
import auth from "../../../middlewares/auth";
import checkDispatcherRoute from "../../../middlewares/checkDispatcherRoute";
import { USER_ROLES } from "../../../../enums/user";
import validateRequest from "../../../middlewares/validateRequest";
import { MobilityValidations } from "./mobility.validation";
import {
  getSingleFilePath,
  getUploadFields,
} from "../../../middlewares/fileUploaderHandlar";

const router = express.Router();

router
  .route("/")
  .post(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/settings"),
    getUploadFields(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const data = req.body;
        const image = getSingleFilePath(
          req.files as Record<string, Express.Multer.File[]>,
          "image",
        );
        req.body.price = Number(req.body.price);
        if (image) {
          req.body.icon = image;
        }
        req.body = data;
        next();
      } catch (error) {
        next(error);
      }
    },
    validateRequest(MobilityValidations.createMobilityZodSchema),
    MobilityController.createMobility,
  )
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.USER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/settings"),
    MobilityController.getAllMobility,
  );

router
  .route("/:id")
  .get(
    auth(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.DISPATCHER,
      USER_ROLES.USER,
      USER_ROLES.DRIVER,
    ),
    checkDispatcherRoute("/settings"),
    MobilityController.getSingleMobility,
  )
  .patch(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/settings"),
    validateRequest(MobilityValidations.updateMobilityZodSchema),
    getUploadFields(),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const data = req.body;
        const image = getSingleFilePath(
          req.files as Record<string, Express.Multer.File[]>,
          "image",
        );
        req.body.price = Number(req.body.price);
        if (image) {
          req.body.icon = image;
        }
        req.body = data;
        next();
      } catch (error) {
        next(error);
      }
    },
    MobilityController.updateMobility,
  )
  .delete(
    auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.DISPATCHER),
    checkDispatcherRoute("/settings"),
    MobilityController.deleteMobility,
  );

export const MobilityRoutes = router;
