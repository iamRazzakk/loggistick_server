import { Queue, QueueEvents } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";

export const EXPORT_TRIP_HISTORY_JOB = "export-trip-history";
export const EXPORT_PAYMENTS_JOB = "export-payments";

export const exportQueue = new Queue("file-export", {
  connection: connectionBullMQ,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 3600, count: 50 },
    removeOnFail: { age: 24 * 3600, count: 50 },
  },
});

export const exportQueueEvents = new QueueEvents("file-export", {
  connection: connectionBullMQ,
});
