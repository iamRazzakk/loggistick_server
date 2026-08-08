import { Schema, model } from "mongoose";
import {
  ICompanySupport,
  CompanySupportModel,
} from "./company_support.interface";

const companySupportSchema = new Schema<ICompanySupport, CompanySupportModel>({
  supportEmail: { type: String, default: "" },
  helplineNumber: { type: String, default: "" },
  dispatcherDirectLine: { type: String, default: "" },
  emergencyHotline: { type: String, default: "" },
  generalOfficeLine: { type: String, default: "" },
  organizationName: { type: String, default: "" },
  headquartersAddress: { type: String, default: "" },
});

export const CompanySupport = model<ICompanySupport, CompanySupportModel>(
  "CompanySupport",
  companySupportSchema,
);
