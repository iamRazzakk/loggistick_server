import { Model, Types } from "mongoose";

export type INotification = {
  text: string;
  description?: string;
  receiver?: Types.ObjectId;
  sender?: Types.ObjectId;
  read: boolean;
  referenceId?: string;
  screen?: "booking" | "chat" | "push_notification";
  type?: "user" | "admin";
};

export type NotificationModel = Model<INotification>;
