import fs from "fs/promises";
import path from "path";
import { Job, UnrecoverableError, Worker } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";
import { buildTripHistoryFile } from "../app/modules/booking/booking.service";
import { buildPaymentFile } from "../app/modules/payment/payment.service";
import {
  EXPORT_PAYMENTS_JOB,
  EXPORT_TRIP_HISTORY_JOB,
} from "../queue/export.queue";
import { ExportFile } from "../shared/tabularExport";

const exportDir = path.join(process.cwd(), "exports");

const saveExport = async (jobId: string, file: ExportFile) => {
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(exportDir, `${jobId}-${file.filename}`);
  await fs.writeFile(filePath, file.buffer);
  return {
    filePath,
    contentType: file.contentType,
    filename: file.filename,
  };
};

const exportFile = async (job: Job) => {
  if (job.name === EXPORT_TRIP_HISTORY_JOB) {
    const { role, query } = job.data as {
      role?: string;
      query: Record<string, any>;
    };
    return saveExport(String(job.id), await buildTripHistoryFile(role, query));
  }
  if (job.name === EXPORT_PAYMENTS_JOB) {
    const { query } = job.data as { query: Record<string, any> };
    return saveExport(String(job.id), await buildPaymentFile(query));
  }
  throw new UnrecoverableError("Unknown export job.");
};

const exportWorker = new Worker("file-export", exportFile, {
  connection: connectionBullMQ,
  concurrency: 2,
});

exportWorker.on("ready", () => {
  console.log("✅ Export worker is ready to process jobs");
});

exportWorker.on("error", (error) => {
  console.error("❌ Export worker error:", error);
});

exportWorker.on("failed", (job, error) => {
  console.error(
    `❌ Export job ${job?.id} failed: ${error.message}`,
  );
});
