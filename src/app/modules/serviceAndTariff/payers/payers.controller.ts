import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";
import { PayersServices } from "./payers.service";

const createPayers = catchAsync(async (req: Request, res: Response) => {
  const result = await PayersServices.createPayersIntoDB(req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Payer created successfully",
    data: result,
  });
});

const getAllPayers = catchAsync(async (_req: Request, res: Response) => {
  const result = await PayersServices.getAllPayersFromDB();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payers fetched successfully",
    data: result,
  });
});

const getAllPayersForAdmin = catchAsync(async (_req: Request, res: Response) => {
  const result = await PayersServices.getAllPayersForAdminFromDB();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payers fetched successfully",
    data: result,
  });
});

const getSinglePayers = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PayersServices.getSinglePayersFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payer fetched successfully",
    data: result,
  });
});

const updatePayers = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PayersServices.updatePayersFromDB(id, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payer updated successfully",
    data: result,
  });
});

const deletePayers = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PayersServices.deletePayersFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Payer deleted successfully",
    data: result,
  });
});

export const PayersController = {
  createPayers,
  getAllPayers,
  getAllPayersForAdmin,
  getSinglePayers,
  updatePayers,
  deletePayers,
};
