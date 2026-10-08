import { Request, Response } from "express";
import { ApplicationsServices } from "./applications.service";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

const updateDriverApplicationsStatus = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const driver =
      await ApplicationsServices.updateDriverApplicationsStatusToDB(
        id,
        req.body,
      );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Driver application status updated successfully",
      data: driver,
    });
  },
);

const getAllDriver = catchAsync(async (req: Request, res: Response) => {
  const { query } = req;
  const { data, meta } = await ApplicationsServices.getAllDriverFromDB(query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "All drivers fetched successfully",
    pagination: meta,
    data,
  });
});

export const ApplicationsController = {
  updateDriverApplicationsStatus,
  getAllDriver,
};
