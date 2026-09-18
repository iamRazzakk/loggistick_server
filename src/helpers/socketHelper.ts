import colors from "colors";
import { Server, Socket } from "socket.io";
import { logger, errorLogger } from "../shared/logger";
import { jwtHelpers } from "./jwtHelper";
import { registerDriverDutySocket } from "../app/modules/appApi/driverDuty/driverDuty.socket";

const resolveToken = (socket: Socket) => {
  const authToken = socket.handshake.auth?.token as string | undefined;
  const headerToken = socket.handshake.headers?.authorization as
    | string
    | undefined;
  const queryToken = socket.handshake.query?.token as string | undefined;
  const raw = authToken || headerToken || queryToken;
  if (!raw) return undefined;
  return raw.startsWith("Bearer ") ? raw.slice(7) : raw;
};

const socket = (io: Server) => {
  io.use((socket, next) => {
    try {
      const token = resolveToken(socket);
      if (!token) {
        return next(new Error("Unauthorized"));
      }
      const user = jwtHelpers.verifyAccessToken(token);
      socket.data.user = user;
      next();
    } catch (error) {
      errorLogger.error(`Socket auth failed: ${error}`);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (client: Socket) => {
    const user = client.data.user;
    logger.info(colors.blue(`Socket connected: ${user?.id}`));
    if (user?.id) {
      await client.join(`user:${user.id}`);
    }

    registerDriverDutySocket(io, client);

    client.on("disconnect", () => {
      logger.info(colors.red(`Socket disconnected: ${user?.id}`));
    });
  });
};

export const socketHelper = { socket };
