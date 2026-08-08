import { Request, Response } from "express";
import { ApplicationsServices } from "./applications.service";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";

const updateDriverApplicationsStatus = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { applicationStatus } = req.body;
    const driver =
      await ApplicationsServices.updateDriverApplicationsStatusToDB(
        id,
        applicationStatus,
      );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Driver application status updated successfully",
      data: driver,
    });
  },
);

export const ApplicationsController = {
  updateDriverApplicationsStatus,
};
