import { Schema, model } from "mongoose";
import { IMobility, MobilityModel } from "./mobility.interface";

const mobilitySchema = new Schema<IMobility, MobilityModel>({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  icon: {
    type: String,
    required: false,
  },
  status: {
    type: Boolean,
    required: true,
    default: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  deletedUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

export const Mobility = model<IMobility, MobilityModel>(
  "Mobility",
  mobilitySchema,
);
