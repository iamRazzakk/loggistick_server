import { Job, UnrecoverableError, Worker } from "bullmq";
import { Types } from "mongoose";
import { connectionBullMQ } from "../config/bullMQ.config";
import { Booking } from "../app/modules/booking/booking.model";
import { CREATE_RECURRING_BOOKINGS_JOB } from "../queue/booking.queue";

const CHUNK_SIZE = 100;

const failOnce = (message: string): never => {
  throw new UnrecoverableError(message);
};

const rollbackBatch = async (recurringBatchId?: string) => {
  if (!recurringBatchId) return;
  await Booking.deleteMany({ recurringBatchId });
};

const createRecurringBookings = async (job: Job) => {
  const { payload, dates } = job.data as {
    payload?: Record<string, any>;
    dates?: string[];
  };
  const recurringBatchId = payload?.recurringBatchId as string | undefined;

  try {
    if (!payload) {
      throw new UnrecoverableError("Booking data is missing. Please try again.");
    }

    if (!Array.isArray(dates) || dates.length === 0) {
      throw new UnrecoverableError(
        "No booking dates found for the selected days and date range.",
      );
    }

    const bookings = dates.map((date) => ({
      ...payload,
      serviceDate: date,
      bookingStatus: "pending",
      recurringBatchId,
      userId: new Types.ObjectId(payload.userId),
      mobilityRequirements: new Types.ObjectId(payload.mobilityRequirements),
      payerSource: new Types.ObjectId(payload.payerSource) || null,
      driverId: new Types.ObjectId(payload.driverId) || null,
    }));

    const created = [];
    for (let i = 0; i < bookings.length; i += CHUNK_SIZE) {
      const state = await job.getState();
      if (state !== "active") {
        await rollbackBatch(recurringBatchId);
        failOnce("Recurring booking creation was cancelled. Please try again.");
      }

      const chunk = bookings.slice(i, i + CHUNK_SIZE);
      const inserted = await Booking.insertMany(chunk, { ordered: true });
      created.push(...inserted);
    }

    return created;
  } catch (error) {
    try {
      await rollbackBatch(recurringBatchId);
    } catch (rollbackError) {
      console.error("❌ Failed to rollback recurring bookings:", rollbackError);
    }

    if (error instanceof UnrecoverableError) {
      throw error;
    }

    throw error;
  }
};

const bookingWorker = new Worker(
  "booking",
  async (job) => {
    if (job.name !== CREATE_RECURRING_BOOKINGS_JOB) {
      failOnce("Unknown booking job.");
    }
    return createRecurringBookings(job);
  },
  {
    connection: connectionBullMQ,
    concurrency: 5,
  },
);

bookingWorker.on("ready", () => {
  console.log("✅ Booking worker is ready to process jobs");
});

bookingWorker.on("error", (err) => {
  console.error("❌ Booking worker error:", err);
});

bookingWorker.on("completed", (job) => {
  console.log(
    `🎉 Job ${job.id?.slice(0, 4)} has been completed ${new Date().toLocaleString()}`,
  );
});

bookingWorker.on("failed", (job, err) => {
  console.error(
    `❌ Job ${job?.id?.slice(0, 4)} has failed with error: ${err.message}`,
  );
});

