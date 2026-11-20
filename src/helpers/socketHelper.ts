import colors from "colors";
import { Server, Socket } from "socket.io";
import { logger } from "../shared/logger";
import { registerBookingLocationSocket } from "../app/modules/booking/booking.socket";
import { jwtHelpers } from "./jwtHelper";
import { User } from "../app/modules/user/user.model";

export type SocketUser = { id: string; role: string };

/** Room every authenticated socket joins — emit to a person with io.to(userRoom(id)). */
export const userRoom = (userId: string) => `user:${userId}`;

// Token from: io(url, { auth: { token } }) · Authorization: Bearer header · ?token=
const readToken = (socket: Socket): string | undefined => {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === "string" && fromAuth) {
    return fromAuth.replace(/^Bearer\s+/i, "");
  }
  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  const fromQuery = socket.handshake.query?.token;
  return typeof fromQuery === "string" && fromQuery ? fromQuery : undefined;
};

// Reject sockets without a valid access token (same checks as REST auth).
const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  try {
    const token = readToken(socket);
    if (!token) return next(new Error("Unauthorized: token required"));

    let decoded;
    try {
      decoded = jwtHelpers.verifyAccessToken(token);
    } catch {
      return next(new Error("Unauthorized: invalid or expired token"));
    }

    const user = await User.findById(decoded.id)
      .select("role isBanned tokenVersion")
      .lean();
    if (!user || user.isBanned || user.role !== decoded.role) {
      return next(new Error("Unauthorized"));
    }
    if (!jwtHelpers.isTokenVersionValid(decoded, user.tokenVersion)) {
      return next(new Error("Unauthorized: session expired"));
    }

    socket.data.user = { id: String(user._id), role: user.role } as SocketUser;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
};

const socket = (io: Server) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(userRoom(user.id));
    logger.info(colors.blue(`A User connected (${user.role})`));
    // booking location socket
    registerBookingLocationSocket(io, socket);
    // disconnect
    socket.on("disconnect", () => {
      logger.info(colors.red("A user disconnect"));
    });
  });
};

export const socketHelper = { socket };
