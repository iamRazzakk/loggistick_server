import { Model } from "mongoose";
import { USER_ROLES } from "../../../enums/user";

export type IPushNotification = {
  title: string;
  message: string;
  role: USER_ROLES;
};

export type PushNotificationModel = Model<IPushNotification>;
