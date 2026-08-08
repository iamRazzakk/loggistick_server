import { NextFunction, Request, Response } from "express";
import { parseBody } from "../../util/parse";

export const parseRequestBody =
  () => (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parseBody(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
