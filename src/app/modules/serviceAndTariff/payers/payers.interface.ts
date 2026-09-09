import { Model } from "mongoose";

export type IPayers = {
  name: string;
  type:
    | "government"
    | "country_payer"
    | "city"
    | "insurance"
    | "self_pay"
    | "facility"
    | "other";
  isActive: boolean;
};

export type PayersModel = Model<IPayers>;
