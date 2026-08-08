import { Request, Response, NextFunction } from "express";
import { FacilitiesAndProgramsServices } from "./facilities_and_programs.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createFacilitiesAndPrograms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await FacilitiesAndProgramsServices.createFacilitiesAndProgramsIntoDB(
        req.body,
      );
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: "Facilities and programs created successfully",
      data: result,
    });
  },
);

const getAllFacilitiesAndPrograms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await FacilitiesAndProgramsServices.getAllFacilitiesAndProgramsFromDB();
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Facilities and programs fetched successfully",
      data: result,
    });
  },
);

const getSingleFacilitiesAndPrograms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await FacilitiesAndProgramsServices.getSingleFacilitiesAndProgramsFromDB(
        req.params.id,
      );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Facilities and programs fetched successfully",
      data: result,
    });
  },
);

const updateFacilitiesAndPrograms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await FacilitiesAndProgramsServices.updateFacilitiesAndProgramsInDB(
        req.params.id,
        req.body,
      );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Facilities and programs updated successfully",
      data: result,
    });
  },
);

const deleteFacilitiesAndPrograms = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result =
      await FacilitiesAndProgramsServices.deleteFacilitiesAndProgramsFromDB(
        req.params.id,
      );
    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Facilities and programs deleted successfully",
      data: result,
    });
  },
);

export const FacilitiesAndProgramsController = {
  createFacilitiesAndPrograms,
  getAllFacilitiesAndPrograms,
  getSingleFacilitiesAndPrograms,
  updateFacilitiesAndPrograms,
  deleteFacilitiesAndPrograms,
};
