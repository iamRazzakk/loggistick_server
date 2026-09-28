import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";
import { AppApiBookingService } from "./booking.service";
import { Request, Response } from "express";

const getMyBookingsOnGoingData = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await AppApiBookingService.getMyBookingsOnGoingDataFromDB(
      req.user,
      req.query,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Bookings fetched successfully",
      data: bookings,
    });
  },
);

const getMyBookingDetailsData = catchAsync(
  async (req: Request, res: Response) => {
    const booking = await AppApiBookingService.getMyBookingDetailsDataFromDB(
      req.user,
      req.params.id,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Booking details fetched successfully",
      data: booking,
    });
  },
);

const getAllUpcomingBookings = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await AppApiBookingService.getAllUpcomingBookingsFromDB(
      req.user,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Bookings fetched successfully",
      data: bookings,
    });
  },
);

const getRecentActivity = catchAsync(async (req: Request, res: Response) => {
  const bookings = await AppApiBookingService.getRecentActivityFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Bookings fetched successfully",
    data: bookings,
  });
});

const getDriverOverviewData = catchAsync(
  async (req: Request, res: Response) => {
    const data = await AppApiBookingService.getDriverOverviewDataFromDB(
      req.user,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Driver overview data fetched successfully",
      data: data,
    });
  },
);

const getUserOnGoingBookingToday = catchAsync(
  async (req: Request, res: Response) => {
    const booking = await AppApiBookingService.getUserOnGoingBookingTodayFromDB(
      req.user,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Booking fetched successfully",
      data: booking,
    });
  },
);

const getDriverCurrentBooking = catchAsync(
  async (req: Request, res: Response) => {
    const booking = await AppApiBookingService.getDriverCurrentBookingFromDB(
      req.user,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Booking fetched successfully",
      data: booking,
    });
  },
);

const getDriverNextTrip = catchAsync(async (req: Request, res: Response) => {
  const booking = await AppApiBookingService.getDriverNextTripFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Next trip fetched successfully",
    data: booking,
  });
});



const getAllDriverTripsList = catchAsync(async (req: Request, res: Response) => {
  const bookings = await AppApiBookingService.getAllDriverTripsListFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "All driver trips list fetched successfully",
    data: bookings,
  });
});

const getUserTotalTripDetails = catchAsync(async (req: Request, res: Response) => {
  const data = await AppApiBookingService.getUserTotalTripDetailsFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "User total trip details fetched successfully",
    data: data,
  });
});

const driverOverViewData = catchAsync(async (req: Request, res: Response) => {
  const data = await AppApiBookingService.driverOverViewDataFromDB(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Driver overview data fetched successfully",
    data: data,
  });
});
export const AppApiBookingController = {
  getMyBookingsOnGoingData,
  getMyBookingDetailsData,
  getAllUpcomingBookings,
  getRecentActivity,
  getDriverOverviewData,
  getUserOnGoingBookingToday,
  getDriverCurrentBooking,
  getDriverNextTrip,
  getAllDriverTripsList,
  getUserTotalTripDetails,
  driverOverViewData,
};
