import { getFirebaseMessaging } from "../firebase";

type IFirebaseNotification = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};

type IFirebaseSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
};

const FCM_MULTICAST_LIMIT = 500;

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const sendNotificationToUsers = async (
  payload: IFirebaseNotification,
): Promise<IFirebaseSendResult> => {
  const tokens = [...new Set(payload.tokens.filter(Boolean))];
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const messaging = getFirebaseMessaging();
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += FCM_MULTICAST_LIMIT) {
    const chunk = tokens.slice(i, i + FCM_MULTICAST_LIMIT);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      ...(payload.data ? { data: payload.data } : {}),
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, index) => {
      if (result.success) return;

      const token = chunk[index];
      console.error("FCM send failed", {
        token,
        code: result.error?.code,
        message: result.error?.message,
      });

      if (result.error && INVALID_TOKEN_CODES.has(result.error.code)) {
        invalidTokens.push(token);
      }
    });
  }

  return { successCount, failureCount, invalidTokens };
};

export const FirebaseHelperFMC = {
  sendNotificationToUsers,
};
