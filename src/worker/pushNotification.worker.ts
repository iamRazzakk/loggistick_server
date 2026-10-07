import { Worker } from "bullmq";
import { connectionBullMQ } from "../config/bullMQ.config";
import { FirebaseHelperFMC } from "../helpers/firebaseHelperFMC";
import {
  PushNotificationJobData,
  SEND_PUSH_NOTIFICATION_JOB,
} from "../queue/pushNotification.queue";
import { User } from "../app/modules/user/user.model";

const removeInvalidTokens = async (tokens: string[]) => {
  if (!tokens.length) return;

  await User.updateMany(
    { fcmToken: { $in: tokens } },
    { $set: { fcmToken: null } },
  );
};

const pushNotificationWorker = new Worker<PushNotificationJobData>(
  "push-notification",
  async (job) => {
    if (job.name !== SEND_PUSH_NOTIFICATION_JOB) return;

    const { userIds, title, body, data } = job.data;
    const users = await User.find({
      _id: { $in: userIds },
      isBanned: false,
      fcmToken: { $exists: true, $nin: [null, ""] },
    }).select("fcmToken");

    const tokens = [
      ...new Set(
        users
          .map((user) => user.fcmToken)
          .filter((token): token is string => Boolean(token)),
      ),
    ];

    if (!tokens.length) return;

    const delivery = await FirebaseHelperFMC.sendNotificationToUsers({
      tokens,
      title,
      body,
      data,
    });
    await removeInvalidTokens(delivery.invalidTokens);
  },
  {
    connection: connectionBullMQ,
    concurrency: 5,
  },
);

pushNotificationWorker.on("ready", () => {
  console.log("✅ Push notification worker is ready to process jobs");
});

pushNotificationWorker.on("error", (err) => {
  console.error("❌ Push notification worker error:", err);
});

pushNotificationWorker.on("completed", (job) => {
  console.log(
    `🎉 Push notification job ${job.id?.slice(0, 4)} completed ${new Date().toLocaleString()}`,
  );
});

pushNotificationWorker.on("failed", (job, err) => {
  console.error(
    `❌ Push notification job ${job?.id?.slice(0, 4)} failed: ${err.message}`,
  );
});
