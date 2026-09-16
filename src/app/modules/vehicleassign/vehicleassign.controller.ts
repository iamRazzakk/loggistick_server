import { Request, Response, NextFunction } from "express";
import { VehicleAssignServices } from "./vehicleassign.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createVehicleAssign = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await VehicleAssignServices.createVehicleAssignIntoDB(
      req.user,
      req.body,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: "Vehicle assign created successfully",
      data: result,
    });
  },
);

const getAllVehicleAssigns = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await VehicleAssignServices.getAllVehicleAssignsFromDB(
      req.query,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Vehicle assigns fetched successfully",
      pagination: result.meta,
      data: result.data,
    });
  },
);

const getSingleVehicleAssign = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await VehicleAssignServices.getSingleVehicleAssignFromDB(
      req.params.id,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Vehicle assign fetched successfully",
      data: result,
    });
  },
);

const updateVehicleAssign = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await VehicleAssignServices.updateVehicleAssignIntoDB(
      req.params.id,
      req.body,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Vehicle assign updated successfully",
      data: result,
    });
  },
);
const deleteVehicleAssign = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const result = await VehicleAssignServices.deleteVehicleAssignFromDB(
      req.params.id,
    );
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Vehicle assign deleted successfully",
      data: result,
    });
  },
);

export const VehicleAssignController = {
  createVehicleAssign,
  getAllVehicleAssigns,
  getSingleVehicleAssign,
  updateVehicleAssign,
  deleteVehicleAssign,
};
