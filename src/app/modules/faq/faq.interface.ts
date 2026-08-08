import { Model } from "mongoose";

export type TFaqRole = "DISPATCHER" | "USER";

export type IFaq = {
  question: string;
  ans: string;
  role: TFaqRole;
};

export type FaqModel = Model<IFaq>;
