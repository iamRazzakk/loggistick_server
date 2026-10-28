import { JwtPayload } from "jsonwebtoken";
import { INotification } from "./notification.interface";
import { Notification } from "./notification.model";
import QueryBuilder from "../../builder/queryBuilder";
import { Types } from "mongoose";

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
    .populate(["sender"], {
      sender: `{firstName: 1, middleName: 1, lastName: 1}`,
    })
    .sort();

  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};
// read notification
const readNotificationIntoDB = async (user: JwtPayload, id: string) => {
  const result = await Notification.findOneAndUpdate(
    { _id: id, receiver: user.id },
    { $set: { read: true } },
    { new: true },
  );
  return result;
};

// read all notifications
const readAllNotificationsIntoDB = async (user: JwtPayload) => {
  const result = await Notification.updateMany(
    { receiver: new Types.ObjectId(user.id), read: false },
    { $set: { read: true } },
  );
  return result;
};

// total unread notifications

const countUnreadNotificationsFromDB = async (user: JwtPayload) => {
  const result = await Notification.countDocuments({
    receiver: user.id,
    read: false,
  }).lean();
  return result;
};

export const NotificationService = {
  createNotificationIntoDB,
  getNotificationsFromDB,
  readNotificationIntoDB,
  readAllNotificationsIntoDB,
  countUnreadNotificationsFromDB,
};
