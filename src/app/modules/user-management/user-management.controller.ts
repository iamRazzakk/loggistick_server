import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { UserManagementServices } from "./user-management.service";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";

const createUserManagement = catchAsync(async (req: Request, res: Response) => {
  const result = await UserManagementServices.createUserManagement(req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "User management created successfully",
    data: result,
  });
});



export const UserManagementController = {
  createUserManagement,
};
