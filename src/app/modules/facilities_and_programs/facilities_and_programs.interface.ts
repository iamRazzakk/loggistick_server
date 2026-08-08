import { Model } from "mongoose";

export type IFacilitiesAndPrograms = {
  name: string;
  type: "hospital" | "clinic" | "program" | "nursingHome" | "other";
  status: boolean;
  isDeleted: boolean;
};

export type FacilitiesAndProgramsModel = Model<IFacilitiesAndPrograms>;
