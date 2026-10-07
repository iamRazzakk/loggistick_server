import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { BroadcastNotificationService } from "./broadcast.service";

const sendBroadcast = catchAsync(async (req: Request, res: Response) => {
  const { title, description, audience } = req.body;
  const result = await BroadcastNotificationService.sendBroadcast({
    title,
    description,
    audience,
    sentBy: req.user.id,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Notification queued successfully",
    data: result,
  });
});

const getBroadcasts = catchAsync(async (req: Request, res: Response) => {
  const result = await BroadcastNotificationService.getBroadcasts(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Notifications fetched successfully",
    pagination: result.meta,
    data: result.result,
  });
});

export const BroadcastNotificationController = {
  sendBroadcast,
  getBroadcasts,
};
