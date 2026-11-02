import { Worker } from "bullmq";
import { sendEmail } from "../services/email.service";
import { connectionBullMQ } from "../config/bullMQ.config";

const reportAssignedWorker = new Worker(
  "report-assigned",
  async (job) => {
    try {
      const { to, subject, html } = job.data;
      console.log(
        `📧 Processing report assigned job ${job.id?.slice(0, 4)} to ${to.slice(0, 4)}`,
      );
      await sendEmail(to, subject, html);
      console.log(`✅ Report assigned sent successfully to ${to.slice(0, 4)}`);
    } catch (error) {
      console.error(
        `❌ Failed to send report assigned for job ${job.id}:`,
        error,
      );
      throw error;
    }
  },
  {
    connection: connectionBullMQ,
    concurrency: 5,
  },
);

reportAssignedWorker.on("ready", () => {
  console.log("✅ Report assigned worker is ready to process jobs");
});

reportAssignedWorker.on("error", (err) => {
  console.error("❌ Report assigned worker error:", err);
});

reportAssignedWorker.on("completed", (job) => {
  console.log(
    `🎉 Job ${job.id?.slice(0, 4)} has been completed ${new Date().toLocaleString()}`,
  );
});

reportAssignedWorker.on("failed", (job, err) => {
  console.error(
    `❌ Job ${job?.id?.slice(0, 4)} has failed with error: ${err.message}`,
  );
});
