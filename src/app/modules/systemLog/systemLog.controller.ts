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

export const SystemLogController = { getSystemLogs };
