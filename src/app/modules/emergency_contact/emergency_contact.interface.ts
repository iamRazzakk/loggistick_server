import { Model, Types } from "mongoose";
import { EMERGENCY_RELATIONSHIPS } from "./emergency_contact.constants";

type EmergencyRelationship = (typeof EMERGENCY_RELATIONSHIPS)[number];

export type IEmergencyContact = {
  userId: Types.ObjectId;
  name: string;
  relationship: EmergencyRelationship;
  contactNumber: string;
};

export type EmergencyContactModel = Model<IEmergencyContact>;
