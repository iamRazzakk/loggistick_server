import colors from "colors";
import { Server } from "socket.io";
import { logger } from "../shared/logger";
import { registerBookingLocationSocket } from "../app/modules/booking/booking.socket";

const socket = (io: Server) => {
  io.on("connection", (socket) => {
    logger.info(colors.blue("A User connected"));
    // booking location socket
    registerBookingLocationSocket(io, socket);
    // disconnect
    socket.on("disconnect", () => {
      logger.info(colors.red("A user disconnect"));
    });
  });
};

export const socketHelper = { socket };
