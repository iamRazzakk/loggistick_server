import fs from "fs/promises";
import { StatusCodes } from "http-status-codes";
import ApiError from "../errors/ApiErrors";
import { exportQueue, exportQueueEvents } from "../queue/export.queue";

const EXPORT_WAIT_MS = 5 * 60 * 1000;

type ExportJobResult = {
  filePath: string;
  contentType: string;
  filename: string;
};

export const runExportJob = async (
  name: string,
  data: Record<string, unknown>,
) => {
  await exportQueueEvents.waitUntilReady();
  const job = await exportQueue.add(name, data);
  try {
    const result = (await job.waitUntilFinished(
      exportQueueEvents,
      EXPORT_WAIT_MS,
    )) as ExportJobResult;
    const buffer = await fs.readFile(result.filePath);
    await fs.unlink(result.filePath).catch(() => undefined);
    return {
      buffer,
      contentType: result.contentType,
      filename: result.filename,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Export failed. Please try again.";
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message);
  }
};
