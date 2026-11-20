import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { SystemLogServices } from "./systemLog.service";

const getSystemLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await SystemLogServices.getSystemLogsFromDB(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "System logs retrieved successfully",
    pagination: result.meta,
    data: result.data,
  });
});

const getActorRoleOptions = catchAsync(async (_req: Request, res: Response) => {
  const result = await SystemLogServices.getActorRoleOptionsFromDB();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Actor role options retrieved successfully",
    data: result,
  });
});

export const SystemLogController = { getSystemLogs, getActorRoleOptions };
