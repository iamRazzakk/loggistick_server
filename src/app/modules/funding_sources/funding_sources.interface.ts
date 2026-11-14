import { Model, Types } from "mongoose";

export type IFundingSources = {
  name: string;
  type:
    | "government"
    | "county"
    | "municipal"
    | "facility"
    | "private"
    | "other";
  programName?: string;
  description?: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  /** Optional default county tariff for this funding source contract. */
  defaultCountyId?: Types.ObjectId | null;
  status: boolean;
  isDeleted: boolean;
};

export type FundingSourcesModel = Model<IFundingSources>;
