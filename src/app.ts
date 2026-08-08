import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import { Morgan } from "./shared/morgan";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import session from "express-session";

import helmet from "helmet";
import { apiLimiter } from "./services/rate-limiter";
import { requireCsrfWhenUsingAuthCookies } from "./util/cookie";
import router from "./app/routes";
import handleStripeWebhook from "./helpers/handleStripeWebhook";
const app = express();

//! stripe
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// morgan
app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//file retrieve
app.use(express.static("uploads"));
app.use(express.static("public"));

// Session middleware (must be before passport initialization)
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Secure should be true in production with HTTPS
  }),
);

// Initialize Passport
// app.use(passport.initialize());
// app.use(passport.session());

//router
app.use(
  "/api/v1",
  apiLimiter,
  //  requireCsrfWhenUsingAuthCookies,
  router,
);

app.get("/", (_req: Request, res: Response) => {
  const currentTime = new Date().toLocaleString();

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Running</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #222;
          color: white;
          text-align: center;
          padding: 100px;
          margin: 0;
        }
        h1 { 
          font-size: 3.5rem; 
          margin-bottom: 20px;
        }
        p { 
          font-size: 1.6rem; 
          margin: 15px 0;
        }
        .time {
          font-family: monospace;
          background: #333;
          padding: 10px 20px;
          border-radius: 8px;
          display: inline-block;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <h1>✅ Server is Running!</h1>
      <p>Your server is working perfectly.</p>
      <p class="time">Current time: ${currentTime}</p>
    </body>
    </html>
  `);
});

//global error handle
app.use(globalErrorHandler);

// handle not found route
app.use((req: Request, res: Response) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: "Not Found",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "API DOESN'T EXIST",
      },
    ],
  });
});

export default app;
