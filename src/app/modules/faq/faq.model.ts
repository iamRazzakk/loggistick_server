import { Schema, model } from "mongoose";
import { IFaq, FaqModel } from "./faq.interface";

const faqSchema = new Schema<IFaq, FaqModel>(
  {
    question: { type: String, required: true },
    ans: { type: String, required: true },
    role: {
      type: String,
      enum: ["DISPATCHER", "USER"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

faqSchema.index({ role: 1 });

export const Faq = model<IFaq, FaqModel>("Faq", faqSchema);
