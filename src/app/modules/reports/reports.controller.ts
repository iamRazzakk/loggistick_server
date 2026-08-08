import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { ReportsServices } from "./reports.service";

const createReport = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.createReportIntoDB(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Report created successfully",
    data: result,
  });
});

const getAllReports = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.getAllReportsFromDB(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Reports fetched successfully",
    pagination: result.meta,
    data: result.data,
  });
});

const getMyReports = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.getMyReportsFromDB(req.user, req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Reports fetched successfully",
    pagination: result.meta,
    data: result.data,
  });
});

const getReportById = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.getReportByIdFromDB(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Report fetched successfully",
    data: result,
  });
});

const updateReport = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.updateReportInDB(
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Report updated successfully",
    data: result,
  });
});

const deleteReport = catchAsync(async (req: Request, res: Response) => {
  const result = await ReportsServices.deleteReportFromDB(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Report deleted successfully",
    data: result,
  });
});

export const ReportsController = {
  createReport,
  getAllReports,
  getMyReports,
  getReportById,
  updateReport,
  deleteReport,
};
