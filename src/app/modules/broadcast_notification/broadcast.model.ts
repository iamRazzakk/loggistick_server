import { Schema, model } from "mongoose";
import {
  BROADCAST_AUDIENCES,
  BROADCAST_STATUSES,
  BroadcastNotificationModel,
  IBroadcastNotification,
} from "./broadcast.interface";

const broadcastNotificationSchema = new Schema<
  IBroadcastNotification,
  BroadcastNotificationModel
>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    audience: {
      type: [String],
      enum: BROADCAST_AUDIENCES,
      required: true,
    },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: BROADCAST_STATUSES,
      default: "sent",
    },
  },
  {
    timestamps: true,
  },
);

broadcastNotificationSchema.index({ createdAt: -1 });

export const BroadcastNotification = model<
  IBroadcastNotification,
  BroadcastNotificationModel
>("BroadcastNotification", broadcastNotificationSchema);
