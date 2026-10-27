import { USER_ROLES } from "../enums/user";
import { INotification } from "../app/modules/notification/notification.interface";
import { Notification } from "../app/modules/notification/notification.model";
import { User } from "../app/modules/user/user.model";
import {
  pushNotificationQueue,
  SEND_PUSH_NOTIFICATION_JOB,
} from "../queue/pushNotification.queue";

export const sendNotifications = async (data: any): Promise<INotification> => {
  const result = await Notification.create(data);

  //@ts-ignore
  const socketIo = global.io;

  if (socketIo) {
    socketIo.emit(`get-notification::${data?.receiver}`, result);
  }

  return result;
};

type NotifyAdminsInput = {
  sender: string;
  text: string;
  description?: string;
  referenceId: string;
  screen?: INotification["screen"];
  type?: INotification["type"];
};

export const notifyAdmins = async ({
  sender,
  text,
  description,
  referenceId,
  screen = "booking",
  type = "user",
}: NotifyAdminsInput) => {
  const admin = await User.findOne({
    role: USER_ROLES.SUPER_ADMIN,
    isBanned: { $ne: true },
    _id: { $ne: sender },
  }).select("_id");

  if (!admin) return;

  await sendNotifications({
    receiver: admin._id,
    sender,
    text,
    description,
    referenceId,
    screen,
    type,
  });
};

type SendPushNotificationInput = {
  userIds: string | string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

const toStringData = (data?: Record<string, string>) => {
  if (!data) return undefined;

  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
};

export const sendPushNotification = async ({
  userIds,
  title,
  body,
  data,
}: SendPushNotificationInput) => {
  const ids = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((id) => id?.toString().trim())
        .filter(Boolean),
    ),
  ];

  const trimmedTitle = title?.trim();
  const trimmedBody = body?.trim();
  if (!ids.length || !trimmedTitle || !trimmedBody) return;

  await pushNotificationQueue.add(SEND_PUSH_NOTIFICATION_JOB, {
    userIds: ids,
    title: trimmedTitle,
    body: trimmedBody,
    data: toStringData(data),
  });
};
