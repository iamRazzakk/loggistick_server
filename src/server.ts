import mongoose from "mongoose";
import app from "./app";
import config from "./config";
import { errorLogger, logger } from "./shared/logger";
import colors from "colors";
import { socketHelper } from "./helpers/socketHelper";
import { Server } from "socket.io";
import seedSuperAdmin from "./DB";
import "./worker/email.worker"; // Email worker
import "./worker/booking.worker"; // Booking worker
import "./worker/notification.worker"; // Broadcast notification worker
import "./worker/pushNotification.worker"; // Push notification worker
// redis client
import "./config/redis.config";
import { RedisClient } from "./config/redis.config";
import ApiError from "./errors/ApiErrors";
import { StatusCodes } from "http-status-codes";

//uncaught exception
process.on("uncaughtException", (error) => {
  errorLogger.error("uncaughtException Detected", error);
  process.exit(1);
});

let server: any;

async function main() {
  try {
    // create super admin
    seedSuperAdmin();

    const redisConnected = await RedisClient.connect();
    if (!redisConnected) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Redis connection failed",
      );
    }

    await mongoose.connect(config.database_url as string);
    logger.info(colors.green("🚀 Database connected successfully"));

    const port =
      typeof config.port === "number" ? config.port : Number(config.port);

    server = app.listen(port, config.ip_address as string, () => {
      logger.info(
        colors.yellow(`♻️  Application listening on port:${config.port}`),
      );
    });

    //socket
    const io = new Server(server, {
      pingTimeout: 60000,
      cors: {
        origin: "*",
      },
    });

    socketHelper.socket(io);
    //@ts-ignore
    global.io = io;
  } catch (error: any) {
    console.log(error.message);
    errorLogger.error(colors.red("🤢 Application startup failed"), {
      message: error?.message || error,
      stack: error?.stack,
    });
    process.exit(1);
  }

  //handle unhandledRejection
  process.on("unhandledRejection", (error) => {
    if (server) {
      server.close(() => {
        errorLogger.error("UnhandledRejection Detected", error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

//SIGTERM
process.on("SIGTERM", async () => {
  logger.info("SIGTERM IS RECEIVE");
  if (server) {
    server.close();
  }
  await RedisClient.disconnect();
});
