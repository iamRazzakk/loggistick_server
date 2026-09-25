import { Schema, model } from "mongoose";
import { IBankcard, BankcardModel } from "./bankcard.interface";

const bankcardSchema = new Schema<IBankcard, BankcardModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cardNumber: {
      type: String,
      required: true,
    },
    cardExpirationDate: {
      type: String,
      required: true,
    },
    cardCvv: {
      type: String,
      required: true,
    },
    cardHolderName: {
      type: String,
      required: true,
    },
    zipCode: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Bankcard = model<IBankcard, BankcardModel>(
  "Bankcard",
  bankcardSchema,
);
