import { Request, Response, NextFunction } from "express";
import { BookingServices } from "./booking.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingServices.createBookingIntoDB(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Booking created successfully",
    data: booking,
  });
});

const getAllMyBookings = catchAsync(async (req: Request, res: Response) => {
  const bookings = await BookingServices.getAllMyBookingsFromDB(
    req.user,
    req.query,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Bookings fetched successfully",
    pagination: bookings.meta,
    data: bookings.data,
  });
});

const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  const bookings = await BookingServices.getAllBookingsFromDB(
    req.user,
    req.query,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Bookings fetched successfully",
    pagination: bookings.meta,
    data: bookings.data,
  });
});
const getAllApprovedBookings = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await BookingServices.getAllApprovedBookingsFromDB(
      req.user,
      req.query,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Approved bookings fetched successfully",
      pagination: bookings.meta,
      data: bookings.data,
    });
  },
);

const getTripHistory = catchAsync(async (req: Request, res: Response) => {
  const bookings = await BookingServices.getTripHistoryFromDB(
    req.user,
    req.query,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Trip history fetched successfully",
    pagination: bookings.meta,
    data: bookings.data,
  });
});

const updateBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingServices.updateBookingInDB(
    req.params.id,
    req.body,
    req.user,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking updated successfully",
    data: booking,
  });
});

const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingServices.getBookingByIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Booking fetched successfully",
    data: booking,
  });
});

const getScheduledBookings = catchAsync(async (req: Request, res: Response) => {
  const bookings = await BookingServices.getScheduledBookingsFromDB(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Scheduled bookings fetched successfully",
    data: bookings,
  });
});

const getSingleRiderBookingHistory = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await BookingServices.getSingleRiderBookingHistoryFromDB(
      req.params.id,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Single rider booking history fetched successfully",
      data: bookings,
    });
  },
);

const calculateTotalTripPrice = catchAsync(
  async (req: Request, res: Response) => {
    const price = await BookingServices.calculateTotalTripPrice(
      req.body.pickup,
      req.body.dropoff,
      req.body.stop,
      req.body.payerId,
      req.body.tripType,
      req.body.mobilityRequirements,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Total trip price calculated successfully",
      data: price,
    });
  },
);

export const BookingController = {
  createBooking,
  getAllMyBookings,
  getAllBookings,
  getAllApprovedBookings,
  getTripHistory,
  updateBooking,
  getBookingById,
  getScheduledBookings,
  getSingleRiderBookingHistory,
  calculateTotalTripPrice,
};
