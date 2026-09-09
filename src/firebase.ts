import path from "path";
import admin from "firebase-admin";

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

admin.initializeApp({
  // @ts-ignore
  credential: admin.credential.cert(serviceAccountPath),
});

// @ts-ignore
export const messaging = admin.messaging();
