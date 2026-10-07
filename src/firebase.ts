import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { StatusCodes } from "http-status-codes";
import config from "./config";
import ApiError from "./errors/ApiErrors";

export const getFirebaseMessaging = () => {
  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Firebase credentials are not configured",
    );
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getMessaging();
};
