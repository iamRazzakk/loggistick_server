import { Model } from "mongoose";

export type IFundingSources = {
  name: string;
  type:
    | "government"
    | "county"
    | "municipal"
    | "facility"
    | "private"
    | "other";
  status: boolean;
  isDeleted: boolean;
};

export type FundingSourcesModel = Model<IFundingSources>;
