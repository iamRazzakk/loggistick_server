import { JwtPayload } from "jsonwebtoken";
import { BankcardModel, IBankcard } from "./bankcard.interface";
import { Bankcard } from "./bankcard.model";

const createBankCard = async (user: JwtPayload, payload: IBankcard) => {
  payload.userId = user.id;
  const existingBankCard = await Bankcard.findOne({ userId: user.id }).lean();
  if (existingBankCard) {
    return await Bankcard.findByIdAndUpdate(existingBankCard._id, payload, {
      new: true,
    });
  }
  return await Bankcard.create(payload);
};

const getBankCard = async (user: JwtPayload) => {
  return await Bankcard.findOne({ userId: user.id }).lean();
};

export const BankcardServices = {
  createBankCard,
  getBankCard,
};
