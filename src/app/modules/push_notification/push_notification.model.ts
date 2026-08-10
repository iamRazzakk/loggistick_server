import { Schema, model } from "mongoose";
import {
  IPushNotification,
  PushNotificationModel,
} from "./push_notification.interface";
import { USER_ROLES } from "../../../enums/user";

const pushNotificationSchema = new Schema<
  IPushNotification,
  PushNotificationModel
>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    role: { type: String, enum: Object.values(USER_ROLES), required: true },
  },
  {
    timestamps: true,
  },
);

export const PushNotification = model<IPushNotification, PushNotificationModel>(
  "PushNotification",
  pushNotificationSchema,
);
