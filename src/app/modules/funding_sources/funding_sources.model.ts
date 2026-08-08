import { Schema, model } from "mongoose";
import {
  IFundingSources,
  FundingSourcesModel,
} from "./funding_sources.interface";

const fundingSourcesSchema = new Schema<IFundingSources, FundingSourcesModel>({
  name: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
});

export const FundingSources = model<IFundingSources, FundingSourcesModel>(
  "FundingSources",
  fundingSourcesSchema,
);
