import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { DriverDutyServices } from "./driverduty.service";

const toggleDuty = catchAsync(async (req: Request, res: Response) => {
  const { action, duty } = await DriverDutyServices.toggleDutyIntoDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      action === "on"
        ? "Duty started successfully"
        : "Duty ended successfully",
    data: duty,
  });
});

const getCurrentDuty = catchAsync(async (req: Request, res: Response) => {
  const result = await DriverDutyServices.getCurrentDutyFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Duty status retrieved successfully",
    data: result,
  });
});

const getMyDutyHistory = catchAsync(async (req: Request, res: Response) => {
  const result = await DriverDutyServices.getMyDutyHistoryFromDB(
    req.user,
    req.query,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Duty history retrieved successfully",
    pagination: result.meta,
    data: result.data,
  });
});

const getDutyLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await DriverDutyServices.getDutyLogsFromDB(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Duty logs retrieved successfully",
    pagination: result.meta,
    data: result.data,
  });
});

export const DriverDutyController = {
  toggleDuty,
  getCurrentDuty,
  getMyDutyHistory,
  getDutyLogs,
};
