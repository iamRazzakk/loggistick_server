import { QueueOptions } from "bullmq";

const bullMQHost =
  process.env.BULLMQIP || process.env.REDIS_HOST || "localhost";
const bullMQPort = process.env.BULLMQPORT || process.env.REDIS_PORT || 6379;

export const connectionBullMQ: QueueOptions["connection"] = {
  host: bullMQHost,
  port: Number(bullMQPort),
};
