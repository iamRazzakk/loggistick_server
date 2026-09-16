import { Model, Types } from "mongoose";

export type IDriverrating = {
  driverId: Types.ObjectId;
  userId: Types.ObjectId;
  tripId: Types.ObjectId;
  rating: number;
  comment: string;
};

export type DriverratingModel = Model<IDriverrating>;
