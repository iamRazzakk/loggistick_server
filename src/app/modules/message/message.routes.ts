import express, { NextFunction, Request, Response } from "express";
import { USER_ROLES } from "../../../enums/user";
import auth from "../../middlewares/auth";
import { MessageController } from "./message.controller";
import { fileUploadHandler } from "../../../shared/fileUploadHandler";
import { getSingleFilePath } from "../../middlewares/fileUploaderHandlar";
const router = express.Router();

router.post(
  "/",
  fileUploadHandler(),
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.DISPATCHER,
    USER_ROLES.USER,
    USER_ROLES.DRIVER,
  ),
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const image = getSingleFilePath(
        req.files as Record<string, Express.Multer.File[]>,
        "image",
      );
      data.image = image;
      req.body = data;
      next();
    } catch (error) {
      next(error as Error);
    }
  },

  MessageController.sendMessage,
);
router.get(
  "/:id",
  auth(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.DISPATCHER,
    USER_ROLES.USER,
    USER_ROLES.DRIVER,
  ),
  MessageController.getMessage,
);

export const MessageRoutes = router;
