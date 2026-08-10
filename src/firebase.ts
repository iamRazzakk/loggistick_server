import path from "path";
import admin from "firebase-admin";

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

export const messaging = admin.messaging();
