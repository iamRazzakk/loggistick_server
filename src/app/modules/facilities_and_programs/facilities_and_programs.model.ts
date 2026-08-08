import { Schema, model } from "mongoose";
import {
  IFacilitiesAndPrograms,
  FacilitiesAndProgramsModel,
} from "./facilities_and_programs.interface";

const facilitiesAndProgramsSchema = new Schema<
  IFacilitiesAndPrograms,
  FacilitiesAndProgramsModel
>({
  name: { type: String, required: true },
  type: { type: String, required: true },
  status: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
});

export const FacilitiesAndPrograms = model<
  IFacilitiesAndPrograms,
  FacilitiesAndProgramsModel
>("FacilitiesAndPrograms", facilitiesAndProgramsSchema);
