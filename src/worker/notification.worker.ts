import { Worker } from "bullmq";
import { BroadcastNotificationService } from "../app/modules/broadcast_notification/broadcast.service";
import { connectionBullMQ } from "../config/bullMQ.config";
import { SEND_BROADCAST_JOB } from "../queue/notification.queue";

const notificationWorker = new Worker(
  "broadcast-notification",
  async (job) => {
    if (job.name !== SEND_BROADCAST_JOB) return;
    await BroadcastNotificationService.processBroadcast(job.data.notificationId);
  },
  {
    connection: connectionBullMQ,
    concurrency: 1,
  },
);

notificationWorker.on("ready", () => {
  console.log("✅ Notification worker is ready to process jobs");
});

notificationWorker.on("error", (err) => {
  console.error("❌ Notification worker error:", err);
});

notificationWorker.on("completed", (job) => {
  console.log(
    `🎉 Notification job ${job.id?.slice(0, 4)} completed ${new Date().toLocaleString()}`,
  );
});

notificationWorker.on("failed", async (job, err) => {
  console.error(
    `❌ Notification job ${job?.id?.slice(0, 4)} failed: ${err.message}`,
  );

  const attempts = job?.opts.attempts ?? 1;
  if (!job?.data?.notificationId || job.attemptsMade < attempts) return;

  await BroadcastNotificationService.markBroadcastFailed(
    job.data.notificationId,
  ).catch((error) => {
    console.error("Failed to mark broadcast as failed", error);
  });
});

