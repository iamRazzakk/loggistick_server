import mongoose from "mongoose";
import config from "../src/config/index";
process.env.NODE_TEST_ENV = 'test';
import worker from "../src/worker/email.worker";
import { emailQueue } from "../src/config/bullMQ.config";
import redisClient from "../src/config/redis.config";
beforeAll(async () => {
    jest.spyOn(console, "log").mockImplementation(() => { });
    jest.spyOn(console, "error").mockImplementation(() => { });
    jest.spyOn(console, "warn").mockImplementation(() => { });



    await mongoose.connect(config.database_url as string);



    if (redisClient && redisClient.status === "close") {
        await redisClient.connect().catch(() => {
            console.error("Failed to connect redis client");
        });
    }



    // close 
    process.on("uncaughtException", (err) => {
        if (err.message.includes("Connection is closed")) {
            return;
        }
        console.error("Uncaught Exception:", err);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error("Unhandled Rejection at:", promise, "reason:", reason);
    });
});


afterAll(async () => {
    await worker.close().catch(() => {
        console.error("Failed to close worker");
    });

    // close email queue
    await emailQueue.close().catch(() => {
        console.error("Failed to close email queue");
    });

    await redisClient.quit().catch(() => {
        console.error("Failed to close redis client");
    });

    await mongoose.disconnect().catch(() => { });
});