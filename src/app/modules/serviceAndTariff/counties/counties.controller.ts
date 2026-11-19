import { Request, Response } from "express";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { CountiesService } from "./counties.service";

const createCounties = catchAsync(async (req: Request, res: Response) => {
  const result = await CountiesService.createCountiesIntoDB(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "County created successfully",
    data: result,
  });
});

const getAllCounties = catchAsync(async (req: Request, res: Response) => {
  const countyId =
    typeof req.query.countyId === "string" ? req.query.countyId : undefined;
  const fields =
    typeof req.query.fields === "string" ? req.query.fields : undefined;
  const result = await CountiesService.getAllCountiesFromDB(countyId, fields);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Counties fetched successfully",
    data: result,
  });
});

const getAllCountiesAdmin = catchAsync(async (req: Request, res: Response) => {
  const fields =
    typeof req.query.fields === "string" ? req.query.fields : undefined;
  const result = await CountiesService.getAllCountiesForAdmin(
    req.params.id,
    fields,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Counties fetched successfully",
    data: result,
  });
});

const getSingleCounty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CountiesService.getSingleCountyFromDB(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "County fetched successfully",
    data: result,
  });
});

const updateCounties = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CountiesService.updateCountiesFromDB(id, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "County updated successfully",
    data: result,
  });
});

const deleteCounties = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CountiesService.deleteCountiesFromDB(id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "County deleted successfully",
    data: result,
  });
});

const checkLocation = catchAsync(async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const result = await CountiesService.findCountyByLocationFromDB(lng, lat);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "County location checked successfully",
    data: result,
  });
});

const updateCountiesAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CountiesService.updateCountiesAdminFromDB(id, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "County updated successfully",
    data: result,
  });
});
export const CountiesController = {
  createCounties,
  getAllCounties,
  getSingleCounty,
  updateCounties,
  deleteCounties,
  checkLocation,
  getAllCountiesAdmin,
  updateCountiesAdmin,
};
