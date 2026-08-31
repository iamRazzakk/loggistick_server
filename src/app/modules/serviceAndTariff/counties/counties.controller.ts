import { NextFunction, Request, Response } from "express";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { CountiesService } from "./counties.service";

const createCounties = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CountiesService.createCountiesIntoDB(req.body);
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: "Counties created successfully",
      data: result,
    });
  },
);

const getAllCounties = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CountiesService.getAllCountiesFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Counties fetched successfully",
      data: result,
    });
  },
);
// admin
const getAllCountiesAdmin = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CountiesService.getAllCountiesForAdmin();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Counties fetched successfully",
      data: result,
    });
  },
);

const getSingleCounty = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await CountiesService.getSingleCountyFromDB(id);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "County fetched successfully",
      data: result,
    });
  },
);

const updateCounties = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { ...countyData } = req.body;
    const result = await CountiesService.updateCountiesFromDB(id, countyData);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "County updated successfully",
      data: result,
    });
  },
);

const deleteCounties = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const result = await CountiesService.deleteCountiesFromDB(id);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "County deleted successfully",
      data: result,
    });
  },
);

const checkLocation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const result = await CountiesService.findCountyByLocationFromDB(lng, lat);
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "County location checked successfully",
      data: result,
    });
  },
);

const seedCounties = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await CountiesService.seedCountiesFromGeoFenceIntoDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Geofence counties seeded successfully",
      data: result,
    });
  },
);

export const CountiesController = {
  createCounties,
  getAllCounties,
  getSingleCounty,
  updateCounties,
  deleteCounties,
  checkLocation,
  seedCounties,
  getAllCountiesAdmin,
};
