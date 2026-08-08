import { RequestHandler } from "express";
import { getUploadFields } from "../app/middlewares/fileUploaderHandlar";

export const fileUploadHandler = (): RequestHandler => {
  return (req, res, next) => {
    const uploader = getUploadFields();

    uploader(req, res, (err: any) => {
      if (err) return next(err);
      next();
    });
  };
};