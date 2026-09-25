import { Request, Response, NextFunction } from "express";
import { BankcardServices } from "./bankcard.service";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";

const createBankCard = catchAsync(async (req: Request, res: Response) => {
  const bankCard = await BankcardServices.createBankCard(req.user, req.body);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "Bank card created successfully",
    data: bankCard,
  });
});

const getBankCard = catchAsync(async (req: Request, res: Response) => {
  const bankCard = await BankcardServices.getBankCard(req.user);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "Bank card retrieved successfully",
    data: bankCard,
  });
});
export const BankcardController = {
  createBankCard,
  getBankCard,
};
