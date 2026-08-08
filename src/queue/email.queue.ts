import { Queue } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";

export const emailQueue = new Queue("send-email", {
    connection: connectionBullMQ,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: false,
    },
  });
  