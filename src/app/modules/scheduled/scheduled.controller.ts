import { Request, Response } from "express";
import { ScheduledServices } from "./scheduled.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const getAllBookingScheduledToday = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await ScheduledServices.getAllBookingScheduledTodayFromDB(
      req.query,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Bookings fetched successfully",
      pagination: bookings.meta,
      data: bookings.data,
    });
  },
);

const getTodayScheduledTripsOnboarding = catchAsync(
  async (_req: Request, res: Response) => {
    const todayScheduledTripsOnboarding = await ScheduledServices.getTodayScheduledTripsOnboardingFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Today scheduled trips onboarding fetched successfully",
      data: todayScheduledTripsOnboarding,
    });
  },
);
export const ScheduledController = {
  getAllBookingScheduledToday,
  getTodayScheduledTripsOnboarding,
};
