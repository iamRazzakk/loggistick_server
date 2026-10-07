import { Model, Types } from "mongoose";

export const BROADCAST_AUDIENCES = [
  "ALL",
  "USER",
  "DRIVER",
  "DISPATCHER",
] as const;

export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number];

export const BROADCAST_STATUSES = ["queued", "sent", "failed"] as const;

type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export type IBroadcastNotification = {
  title: string;
  description: string;
  audience: BroadcastAudience[];
  sentBy: Types.ObjectId;
  successCount: number;
  failureCount: number;
  status: BroadcastStatus;
};

export type BroadcastNotificationModel = Model<IBroadcastNotification>;
