import { Queue, QueueEvents } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";

export const CREATE_RECURRING_BOOKINGS_JOB = "create-recurring-bookings";

export const bookingQueue = new Queue("booking", {
  connection: connectionBullMQ,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: {
      age: 3600,
      count: 100,
    },
    removeOnFail: false,
  },
});

export const bookingQueueEvents = new QueueEvents("booking", {
  connection: connectionBullMQ,
});
