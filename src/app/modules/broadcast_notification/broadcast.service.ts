import { UnrecoverableError } from "bullmq";
import { USER_ROLES } from "../../../enums/user";
import { FirebaseHelperFMC } from "../../../helpers/firebaseHelperFMC";
import { SEND_BROADCAST_JOB, notificationQueue } from "../../../queue/notification.queue";
import QueryBuilder from "../../builder/queryBuilder";
import { User } from "../user/user.model";
import { BroadcastAudience } from "./broadcast.interface";
import { BroadcastNotification } from "./broadcast.model";

type SendBroadcastPayload = {
  title: string;
  description: string;
  audience: BroadcastAudience | BroadcastAudience[];
  sentBy: string;
};

const normalizeAudience = (
  audience: BroadcastAudience | BroadcastAudience[],
): BroadcastAudience[] => {
  const values = [...new Set(Array.isArray(audience) ? audience : [audience])];
  if (values.includes("ALL")) return ["ALL"];
  return values;
};

const collectTokens = async (audience: BroadcastAudience[]) => {
  const roles = audience.includes("ALL")
    ? [USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.DISPATCHER]
    : audience;

  const users = await User.find({
    role: { $in: roles },
    isBanned: false,
  }).select("fcmToken");

  return [
    ...new Set(
      users
        .map((user) => user.fcmToken)
        .filter((token): token is string => Boolean(token)),
    ),
  ];
};

const removeInvalidTokens = async (tokens: string[]) => {
  if (!tokens.length) return;

  await User.updateMany(
    { fcmToken: { $in: tokens } },
    { $set: { fcmToken: null } },
  );
};

const sendBroadcast = async (payload: SendBroadcastPayload) => {
  const title = payload.title.trim();
  const description = payload.description.trim();
  const audience = normalizeAudience(payload.audience);

  const notification = await BroadcastNotification.create({
    title,
    description,
    audience,
    sentBy: payload.sentBy,
    successCount: 0,
    failureCount: 0,
    status: "queued",
  });

  try {
    await notificationQueue.add(
      SEND_BROADCAST_JOB,
      { notificationId: String(notification._id) },
      { jobId: String(notification._id) },
    );
  } catch (error) {
    await BroadcastNotification.findByIdAndDelete(notification._id);
    throw error;
  }

  return notification;
};

const processBroadcast = async (notificationId: string) => {
  const notification = await BroadcastNotification.findById(notificationId);
  if (!notification) {
    throw new UnrecoverableError("Broadcast notification was not found.");
  }

  if (notification.status === "sent") return;

  const tokens = await collectTokens(notification.audience);

  const delivery = await FirebaseHelperFMC.sendNotificationToUsers({
    tokens,
    title: notification.title,
    body: notification.description,
    data: {
      audience: notification.audience.join(","),
    },
  });

  await removeInvalidTokens(delivery.invalidTokens);

  notification.successCount = delivery.successCount;
  notification.failureCount = delivery.failureCount;
  notification.status = "sent";
  await notification.save();
};

const markBroadcastFailed = async (notificationId: string) => {
  await BroadcastNotification.updateOne(
    { _id: notificationId, status: { $ne: "sent" } },
    { $set: { status: "failed" } },
  );
};

const getBroadcasts = async (query: Record<string, unknown>) => {
  const data = new QueryBuilder(BroadcastNotification.find(), query)
    .sort()
    .paginate()
    .fields()
    .populate(["sentBy"], { sentBy: "firstName lastName email role" });

  const [result, meta] = await Promise.all([
    data.modelQuery.exec(),
    data.getPaginationInfo(),
  ]);

  return { result, meta };
};

export const BroadcastNotificationService = {
  sendBroadcast,
  processBroadcast,
  markBroadcastFailed,
  getBroadcasts,
};
