import { Request, Response, NextFunction } from "express";
import { PushNotificationServices } from "./push_notification.service";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { StatusCodes } from "http-status-codes";

const createPushNotification = catchAsync(
  async (req: Request, res: Response) => {
    const { body } = req;
    const result =
      await PushNotificationServices.createPushNotificationIntoDB(body);
    sendResponse(res, {
      success: true,
      message: "Push notification created successfully",
      data: result,
      statusCode: StatusCodes.CREATED,
    });
  },
);

const getAllPushNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const { query } = req;
    const result =
      await PushNotificationServices.getAllPushNotificationsFromDB(query);
    sendResponse(res, {
      success: true,
      message: "Push notifications fetched successfully",
      statusCode: StatusCodes.OK,
      pagination: result.meta,
      data: result.result,
    });
  },
);

export const PushNotificationController = {
  createPushNotification,
  getAllPushNotifications,
};
