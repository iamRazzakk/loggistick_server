import { Queue } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";

export const SEND_BROADCAST_JOB = "send-broadcast";

export const notificationQueue = new Queue("broadcast-notification", {
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
});
