import { Request, Response, NextFunction } from "express";
import { DriverratingServices } from "./driverrating.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createDriverRating = catchAsync(async (req: Request, res: Response) => {
  const driverRating = await DriverratingServices.createDriverRatingIntoDB(
    req.body,
    req.user,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Driver rating created successfully",
    data: driverRating,
  });
});

const getAllDriverRatings = catchAsync(async (req: Request, res: Response) => {
  const driverRatings = await DriverratingServices.getAllDriverRatingsFromDB(
    req.query,
    req.params.id,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Driver ratings fetched successfully",
    data: driverRatings,
  });
});

const getSingleDriverRating = catchAsync(
  async (req: Request, res: Response) => {
    const driverRating = await DriverratingServices.getSingleDriverRatingFromDB(
      req.params.id,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Driver rating fetched successfully",
      data: driverRating,
    });
  },
);

const updateDriverRating = catchAsync(async (req: Request, res: Response) => {
  const driverRating = await DriverratingServices.updateDriverRatingIntoDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Driver rating updated successfully",
    data: driverRating,
  });
});

export const DriverratingController = {
  createDriverRating,
  getAllDriverRatings,
  getSingleDriverRating,
  updateDriverRating,
};
