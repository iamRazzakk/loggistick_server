import { Schema, model } from "mongoose";
import {
  IFundingSources,
  FundingSourcesModel,
} from "./funding_sources.interface";

const fundingSourcesSchema = new Schema<IFundingSources, FundingSourcesModel>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    programName: { type: String },
    description: { type: String },
    effectiveFrom: { type: String },
    effectiveUntil: { type: String },
    defaultCountyId: {
      type: Schema.Types.ObjectId,
      ref: "County",
      default: null,
    },
    status: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const FundingSources = model<IFundingSources, FundingSourcesModel>(
  "FundingSources",
  fundingSourcesSchema,
);
