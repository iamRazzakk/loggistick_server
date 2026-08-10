import { StatusCodes } from "http-status-codes";
import ApiError from "../errors/ApiErrors";
import { messaging } from "../firebase";

export type IFirebaseNotification = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

// FCM sendEachForMulticast accepts max 500 tokens per request
const FCM_MULTICAST_LIMIT = 500;

const sendNotificationToUsers = async (payload: IFirebaseNotification) => {
  try {
    const tokens = [...new Set(payload.tokens.filter(Boolean))];
    if (!tokens.length) return;

    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
      const chunk = tokens.slice(i, i + FCM_MULTICAST_LIMIT);
      await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        ...(payload.data ? { data: payload.data } : {}),
      });
    }
  } catch (error) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Failed to send notification",
    );
  }
};

export const FirebaseHelperFMC = {
  sendNotificationToUsers,
};
