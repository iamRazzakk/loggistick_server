import { Request, Response, NextFunction } from "express";
import { PaymentServices } from "./payment.service";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { sendDownload } from "../../../helpers/sendDownload";
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

const getPaymentOverView = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await PaymentServices.getPaymentOverViewFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Payment overview fetched successfully",
      data,
    });
  },
);
const exportAllPaymentsDataInExcelFormat = catchAsync(
  async (req: Request, res: Response) => {
    const file = await PaymentServices.exportAllPaymentsDataInExcelFormatFromDB(
      req.query,
    );
    sendDownload(res, file);
  },
);
export const PaymentController = {
  getAllPayments,
  getPaymentOverView,
  exportAllPaymentsDataInExcelFormat,
};
