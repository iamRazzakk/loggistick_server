import { INotification } from "../app/modules/notification/notification.interface";
import { Notification } from "../app/modules/notification/notification.model";
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
