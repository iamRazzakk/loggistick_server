import { Request, Response, NextFunction } from "express";
import { PaymentServices } from "./payment.service";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
const getAllPayments = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await PaymentServices.getAllPaymentsFromDB(req.query);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Payments fetched successfully",
      pagination: data.meta,
      data: data.data,
    });
  },
);
export const PaymentController = {
  getAllPayments,
};
