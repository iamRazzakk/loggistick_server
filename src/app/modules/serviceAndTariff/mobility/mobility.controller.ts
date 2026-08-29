import { Request, Response, NextFunction } from "express";
import { MobilityServices } from "./mobility.service";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";

const createMobility = catchAsync(async (req: Request, res: Response) => {
  const { ...payload } = req.body;
  const result = await MobilityServices.createMobilityIntoDB(
    payload,
    req.user!,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Mobility created successfully",
    data: result,
  });
});

const getAllMobility = catchAsync(async (req: Request, res: Response) => {
  const result = await MobilityServices.getAllMobilityFromDB();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Mobility fetched successfully",
    data: result,
  });
});

const getSingleMobility = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MobilityServices.getSingleMobilityFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Mobility fetched successfully",
    data: result,
  });
});

const updateMobility = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ...payload } = req.body;
  const result = await MobilityServices.updateMobilityFromDB(id, payload);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Mobility updated successfully",
    data: result,
  });
});

const deleteMobility = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await MobilityServices.deleteMobilityFromDB(id, req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Mobility deleted successfully",
    data: result,
  });
});

export const MobilityController = {
  createMobility,
  getAllMobility,
  getSingleMobility,
  updateMobility,
  deleteMobility,
};
