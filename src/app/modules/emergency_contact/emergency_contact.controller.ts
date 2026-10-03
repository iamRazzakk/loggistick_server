import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { EmergencyContactServices } from "./emergency_contact.service";

const createEmergencyContact = catchAsync(
  async (req: Request, res: Response) => {
    const { contact, created } =
      await EmergencyContactServices.createEmergencyContactIntoDB(
        req.user,
        req.body,
      );
    sendResponse(res, {
      success: true,
      statusCode: created ? StatusCodes.CREATED : StatusCodes.OK,
      message: created
        ? "Emergency contact created successfully"
        : "Emergency contact updated successfully",
      data: contact,
    });
  },
);

const getEmergencyContact = catchAsync(async (req: Request, res: Response) => {
  const contact = await EmergencyContactServices.getEmergencyContactFromDB(
    req.user,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Emergency contact retrieved successfully",
    data: contact,
  });
});

export const EmergencyContactController = {
  createEmergencyContact,
  getEmergencyContact,
};
