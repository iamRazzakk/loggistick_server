import { JwtPayload } from "jsonwebtoken";
import { INotification } from "./notification.interface";
import { Notification } from "./notification.model";
import QueryBuilder from "../../builder/queryBuilder";

const createNotificationIntoDB = async (
  data: INotification,
  user: JwtPayload,
) => {
  data.sender = user.id;
  const result = await Notification.create(data);
  return result;
};

const getNotificationsFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const qb = new QueryBuilder(Notification.find({ receiver: user.id }), query)
    .paginate()
    .sort();

  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};
// read notification
const readNotificationIntoDB = async (user: JwtPayload, id: string) => {
  const result = await Notification.findByIdAndUpdate(
    id,
    { read: true },
    { new: true },
  );
  return result;
};

export const NotificationService = {
  createNotificationIntoDB,
  getNotificationsFromDB,
  readNotificationIntoDB,
};
