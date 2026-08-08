import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IFaq, TFaqRole } from "./faq.interface";
import { Faq } from "./faq.model";

const createFaqIntoDB = async (payload: IFaq) => {
  const result = await Faq.create(payload);
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create FAQ");
  }
  return result;
};

const getAllFaqsFromDB = async (role?: TFaqRole) => {
  const filter = role ? { role } : {};
  const result = await Faq.find(filter).lean();
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to get FAQs");
  }
  return result;
};

const getSingleFaqFromDB = async (id: string) => {
  const data = await Faq.findById(id).lean();
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found");
  }
  return data;
};

const updateFaqInDB = async (id: string, payload: Partial<IFaq>) => {
  const data = await Faq.findByIdAndUpdate(id, payload, {
    new: true,
  }).lean();
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found");
  }
  return data;
};

const deleteFaqFromDB = async (id: string) => {
  const data = await Faq.findByIdAndDelete(id).lean();
  if (!data) {
    throw new ApiError(StatusCodes.NOT_FOUND, "FAQ not found");
  }
  return data;
};

export const FaqServices = {
  createFaqIntoDB,
  getAllFaqsFromDB,
  getSingleFaqFromDB,
  updateFaqInDB,
  deleteFaqFromDB,
};
