import { Schema, model } from "mongoose";
import {
  EmergencyContactModel,
  IEmergencyContact,
} from "./emergency_contact.interface";
import { EMERGENCY_RELATIONSHIPS } from "./emergency_contact.constants";

const emergencyContactSchema = new Schema<
  IEmergencyContact,
  EmergencyContactModel
>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    relationship: {
      type: String,
      enum: EMERGENCY_RELATIONSHIPS,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const EmergencyContact = model<IEmergencyContact, EmergencyContactModel>(
  "EmergencyContact",
  emergencyContactSchema,
);
