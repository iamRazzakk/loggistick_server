import { UnrecoverableError, Worker } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";
import {
  DRIVER_DUTY_QUEUE,
  FLUSH_DRIVER_DUTY_JOB,
} from "../app/modules/driverduty/driverduty.constants";
import { flushDutyToDB } from "../app/modules/driverduty/driverduty.processor";
import { DriverDutyJobData } from "../queue/driverduty.queue";

const driverDutyWorker = new Worker<DriverDutyJobData>(
  DRIVER_DUTY_QUEUE,
  async (job) => {
    if (job.name !== FLUSH_DRIVER_DUTY_JOB) {
      throw new UnrecoverableError("Unknown driver duty job.");
    }

    const driverId = job.data?.driverId;
    if (!driverId) {
      throw new UnrecoverableError("Driver id is missing.");
    }

    return flushDutyToDB(driverId);
  },
  {
    connection: connectionBullMQ,
    concurrency: 6,
  },
);

driverDutyWorker.on("ready", () => {
  console.log("✅ Driver duty worker is ready to process jobs");
});

driverDutyWorker.on("error", (err) => {
  console.error("❌ Driver duty worker error:", err);
});

driverDutyWorker.on("failed", (job, err) => {
  console.error(
    `❌ Driver duty flush ${job?.id?.slice(0, 4)} failed: ${err.message}`,
  );
});
