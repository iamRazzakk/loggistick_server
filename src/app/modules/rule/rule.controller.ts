import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { RuleService } from "./rule.service";

const createRule = catchAsync(async (req: Request, res: Response) => {
  const { type, content } = req.body;
  const rule = await RuleService.createRuleToDB({ type, content });
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Rule created successfully",
    data: rule,
  });
});

const getRule = catchAsync(async (req: Request, res: Response) => {
  const { type } = req.params;
  const rule = await RuleService.getRuleFromDB(
    type as "privacy" | "terms" | "about",
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Rule fetched successfully",
    data: rule,
  });
});

export const RuleController = {
  createRule,
  getRule,
};
