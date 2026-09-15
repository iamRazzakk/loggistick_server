import { Request, Response, NextFunction } from "express";
import { DashboardServices } from "./dashboard.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
const dashboardOverview = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const result = await DashboardServices.dashboardOverviewFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Dashboard overview fetched successfully",
      data: result,
    });
  },
);

const activeTrips = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const result = await DashboardServices.activeTripsFromDB(req.query);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Active trips fetched successfully",
      pagination: result.meta,
      data: result.data,
    });
  },
);

const pendingTrips = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const result = await DashboardServices.pendingTripsFromDB(req.query);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Pending trips fetched successfully",
      pagination: result.meta,
      data: result.data,
    });
  },
);
export const DashboardController = {
  dashboardOverview,
  activeTrips,
  pendingTrips,
};
