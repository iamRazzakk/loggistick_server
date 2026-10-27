import { Queue } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";
import { DRIVER_DUTY_QUEUE } from "../app/modules/driverduty/driverduty.constants";

export { DRIVER_DUTY_QUEUE };

export type DriverDutyJobData = {
  driverId: string;
};

export const driverDutyQueue = new Queue<DriverDutyJobData>(DRIVER_DUTY_QUEUE, {
  connection: connectionBullMQ,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 300, count: 100 },
    removeOnFail: { age: 24 * 3600, count: 50 },
  },
});
