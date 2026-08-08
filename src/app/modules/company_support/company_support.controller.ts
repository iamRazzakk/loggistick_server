import { Request, Response, NextFunction } from "express";
import { CompanySupportServices } from "./company_support.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const upsertCompanySupport = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CompanySupportServices.upsertCompanySupportIntoDB(
      req.body,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Company support saved successfully",
      data: result,
    });
  },
);

const getCompanySupport = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CompanySupportServices.getCompanySupportFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Company support fetched successfully",
      data: result,
    });
  },
);

export const CompanySupportController = {
  upsertCompanySupport,
  getCompanySupport,
};
