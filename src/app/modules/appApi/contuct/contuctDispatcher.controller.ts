import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../../shared/catchAsync";
import sendResponse from "../../../../shared/sendResponse";
import { ContuctDispatcherService } from "./contuctDispatcher.service";

const contuctDispatcher = catchAsync(async (req: Request, res: Response) => {
  const result = await ContuctDispatcherService.contuctDispatcher();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Dispatcher contacted successfully",
    data: result,
  });
});

export const ContuctDispatcherController = {
  contuctDispatcher,
};