import { Schema, model } from "mongoose";
import { IPayers, PayersModel } from "./payers.interface";

const payersSchema = new Schema<IPayers, PayersModel>({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [
      "government",
      "country_payer",
      "city",
      "insurance",
      "self_pay",
      "facility",
      "other",
    ],
  },
  isActive: { type: Boolean, default: true },
});

export const Payers = model<IPayers, PayersModel>("Payers", payersSchema);
