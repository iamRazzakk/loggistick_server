import { Model, Types } from "mongoose";

export type IMobility = {
  name: string;
  price: number;
  icon: string;
  status: boolean;
  creator?: Types.ObjectId;
  deletedUser?: Types.ObjectId;
};

export type MobilityModel = Model<IMobility>;
