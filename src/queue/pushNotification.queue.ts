import { Queue } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";

export const SEND_PUSH_NOTIFICATION_JOB = "send-push-notification";

export type PushNotificationJobData = {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

export const pushNotificationQueue = new Queue<PushNotificationJobData>(
  "push-notification",
  {
    connection: connectionBullMQ,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: false,
    },
  },
);
