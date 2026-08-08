import { Request, Response, NextFunction } from "express";
import { FundingSourcesServices } from "./funding_sources.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createFundingSources = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await FundingSourcesServices.createFundingSourcesIntoDB(
      req.body,
    );
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: "Funding sources created successfully",
      data: result,
    });
  },
);

const getAllFundingSources = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await FundingSourcesServices.getAllFundingSourcesFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Funding sources fetched successfully",
      data: result,
    });
  },
);

const getSingleFundingSources = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await FundingSourcesServices.getSingleFundingSourcesFromDB(
      req.params.id,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Funding sources fetched successfully",
      data: result,
    });
  },
);

const updateFundingSources = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await FundingSourcesServices.updateFundingSourcesInDB(
      req.params.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Funding sources updated successfully",
      data: result,
    });
  },
);

const deleteFundingSources = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await FundingSourcesServices.deleteFundingSourcesFromDB(
      req.params.id,
    );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Funding sources deleted successfully",
      data: result,
    });
  },
);

export const FundingSourcesController = {
  createFundingSources,
  getAllFundingSources,
  getSingleFundingSources,
  updateFundingSources,
  deleteFundingSources,
};
