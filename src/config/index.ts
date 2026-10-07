import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  ip_address: process.env.IP,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  node_env: process.env.NODE_ENV,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
    issuer: process.env.JWT_ISSUER!,
    audience: process.env.JWT_AUDIENCE!,
    tokenVersion: process.env.tokenVersion!,
  },
  stripe: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    paymentSuccess: process.env.PAYMENT_SUCCESS_URL,
    paymentCancel: process.env.PAYMENT_CANCEL_URL,
  },
  email: {
    from: process.env.EMAIL_FROM,
    user: process.env.EMAIL_USER,
    port: process.env.EMAIL_PORT,
    host: process.env.EMAIL_HOST,
    pass: process.env.EMAIL_PASS,
  },
  app: {
    downloadUrl:
      process.env.APP_DOWNLOAD_URL || "https://loggistick.com/download",
  },
  social: {
    google_client_id: process.env.GOOGLE_CLIENT_ID,
    facebook_client_id: process.env.FACEBOOK_CLIENT_ID,
    google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
    facebook_client_secret: process.env.FACEBOOK_CLIENT_SECRET,
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  bullMQ: {
    host: process.env.BULLMQIP!,
    port: process.env.BULLMQPORT!,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    twilioNumber: process.env.TWILIO_NUMBER,
  },

  googleMapApi: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY!,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
};
