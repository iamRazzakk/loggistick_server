import { Model, Types } from "mongoose";

export type IReports = {
  userId?: Types.ObjectId;
  reportStatus: "pending" | "approved" | "rejected";
  documents: string;
  reportedBy: Types.ObjectId;
  tripId: Types.ObjectId;
};

export type ReportsModel = Model<IReports>;
