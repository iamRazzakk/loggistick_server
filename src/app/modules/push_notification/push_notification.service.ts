import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IPushNotification } from "./push_notification.interface";
import { PushNotification } from "./push_notification.model";
import QueryBuilder from "../../builder/queryBuilder";
import { User } from "../user/user.model";
import { FirebaseHelperFMC } from "../../../helpers/firebaseHelperFMC";
import { sendNotifications } from "../../../helpers/notificationsHelper";
import { JwtPayload } from "jsonwebtoken";

const createPushNotificationIntoDB = async (
  payload: IPushNotification,
  user: JwtPayload,
) => {
  const data = await PushNotification.create(payload);
  if (!data) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Failed to create push notification",
    );
  }

  const sender = await User.findById(user.id).select("_id");

  const users = await User.find({
    role: payload.role,
    isBanned: { $ne: true },
  }).select("_id");

  users
    .map((user) => user.fcmToken)
    .filter((token): token is string => Boolean(token));
  // if (tokens.length) {
  //   await FirebaseHelperFMC.sendNotificationToUsers({
  //     tokens,
  //     title: payload.title,
  //     body: payload.message,
  //   });
  // }

  return data;
};

const getAllPushNotificationsFromDB = async (
  query: Record<string, unknown>,
) => {
  const data = new QueryBuilder(PushNotification.find(), query)
    .sort()
    .paginate()
    .fields();
  const [result, meta] = await Promise.all([
    data.modelQuery.exec(),
    data.getPaginationInfo(),
  ]);
  return {
    result,
    meta,
  };
};

export const PushNotificationServices = {
  createPushNotificationIntoDB,
  getAllPushNotificationsFromDB,
};
