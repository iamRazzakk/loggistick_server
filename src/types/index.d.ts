import { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";

declare global {
  var io: Server | undefined;

  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}