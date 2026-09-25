import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { NotificationService } from "./notification.service";
import { JwtPayload } from "jsonwebtoken";

const createNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await NotificationService.createNotificationIntoDB(
    req.body,
    user,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notification Created Successfully",
    data: result,
  });
});

const getNotificationFromDB = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user;
    const result = await NotificationService.getNotificationsFromDB(
      user,
      req.query,
    );

    sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "Notifications Retrieved Successfully",
      pagination: result.meta,
      data: result.data,
    });
  },
);

const readNotification = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await NotificationService.readNotificationIntoDB(
    user,
    req.params.id,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notification Read Successfully",
    data: result,
  });
});

export const NotificationController = {
  createNotification,
  getNotificationFromDB,
  readNotification,
};
