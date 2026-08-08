import { Request, Response } from "express";
import { FaqServices } from "./faq.service";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { StatusCodes } from "http-status-codes";
import { TFaqRole } from "./faq.interface";

const createFaq = catchAsync(async (req: Request, res: Response) => {
  const { ...faqData } = req.body;
  const result = await FaqServices.createFaqIntoDB(faqData);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: "FAQ created successfully",
    data: result,
  });
});

const getAllFaqs = catchAsync(async (req: Request, res: Response) => {
  const role = req.query.role as TFaqRole | undefined;
  const result = await FaqServices.getAllFaqsFromDB(role);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "FAQs fetched successfully",
    data: result,
  });
});

const getSingleFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FaqServices.getSingleFaqFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "FAQ fetched successfully",
    data: result,
  });
});

const updateFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ...faqData } = req.body;
  const result = await FaqServices.updateFaqInDB(id, faqData);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "FAQ updated successfully",
    data: result,
  });
});

const deleteFaq = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await FaqServices.deleteFaqFromDB(id);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: "FAQ deleted successfully",
    data: result,
  });
});

export const FaqController = {
  createFaq,
  getAllFaqs,
  getSingleFaq,
  updateFaq,
  deleteFaq,
};
