import { Request, Response, NextFunction } from "express";
import { VehicleServices } from "./vehicle.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createVehicle = catchAsync(async (req: Request, res: Response) => {
  const { ...vehicleData } = req.body;
  const result = await VehicleServices.createVehicleIntoDB(vehicleData);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Vehicle created successfully",
    data: result,
  });
});
const getAllVehicles = catchAsync(async (req: Request, res: Response) => {
  const result = await VehicleServices.getAllVehiclesFromDB(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Vehicles fetched successfully",
    data: result,
  });
});


const getSingleVehicle = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await VehicleServices.getSingleVehicleFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Vehicle fetched successfully",
    data: result,
  });
});
const updateVehicle = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ...vehicleData } = req.body;
  const result = await VehicleServices.updateVehicleInDB(id, vehicleData);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Vehicle updated successfully",
    data: result,
  });
});
const deleteVehicle = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await VehicleServices.deleteVehicleFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Vehicle deleted successfully",
    data: result,
  });
});

export const VehicleController = {
  createVehicle,
  getAllVehicles,
  getSingleVehicle,
  updateVehicle,
  deleteVehicle,
};
