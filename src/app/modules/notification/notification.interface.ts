import { Model, Types } from "mongoose";

export type INotification = {
  text: string;
  receiver?: Types.ObjectId;
  sender?: Types.ObjectId;
  read: boolean;
  referenceId?: string;
  screen?: "booking" | "chat";
  type?: "user" | "admin";
};

export type NotificationModel = Model<INotification>;
