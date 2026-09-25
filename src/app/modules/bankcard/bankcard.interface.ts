import { Model, Types } from "mongoose";

export type IBankcard = {
  userId: Types.ObjectId;
  cardNumber: string;
  cardExpirationDate: string;
  cardCvv: string;
  cardHolderName: string;
  zipCode: number;
};

export type BankcardModel = Model<IBankcard>;
