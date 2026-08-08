import { Model } from "mongoose";

export type ICompanySupport = {
  supportEmail: string;
  helplineNumber: string;
  dispatcherDirectLine: string;
  emergencyHotline: string;
  generalOfficeLine: string;
  organizationName: string;
  headquartersAddress: string;
};

export type CompanySupportModel = Model<ICompanySupport>;
