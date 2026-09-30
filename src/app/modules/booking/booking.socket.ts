import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { Booking } from "./booking.model";
import { errorLogger } from "../../../shared/logger";

type Ack = (payload: {
  success: boolean;
  message?: string;
  data?: unknown;
}) => void;

type JoinedBooking = { userId: string; role: "USER" | "DRIVER" };

const CLOSED_STATUSES = ["cancelled", "completed"];

const roomOf = (bookingId: string) => `booking:${bookingId}`;

const safeAck = (ack: Ack | undefined, payload: Parameters<Ack>[0]) => {
  if (typeof ack === "function") ack(payload);
};

const joinedBookings = (socket: Socket): Record<string, JoinedBooking> => {
  if (!socket.data.joinedBookings) socket.data.joinedBookings = {};
  return socket.data.joinedBookings;
};

const findBookingMember = async (userId: string, bookingId: string) => {
  if (!Types.ObjectId.isValid(bookingId) || !Types.ObjectId.isValid(userId)) {
    return null;
  }
  const booking = await Booking.findById(bookingId)
    .select("userId driverId bookingStatus")
    .lean();
  if (!booking || CLOSED_STATUSES.includes(booking.bookingStatus)) return null;
  if (String(booking.driverId) === userId)
    return { booking, role: "DRIVER" as const };
  if (String(booking.userId) === userId)
    return { booking, role: "USER" as const };
  return null;
};

export const registerBookingLocationSocket = (_io: Server, socket: Socket) => {
  socket.on("booking:join", async (payload, ack: Ack) => {
    try {
      const bookingId = payload?.bookingId as string | undefined;
      const userId = payload?.userId as string | undefined;
      if (!bookingId || !userId) {
        return safeAck(ack, {
          success: false,
          message: "bookingId and userId required",
        });
      }
      const member = await findBookingMember(userId, bookingId);
      if (!member) {
        return safeAck(ack, {
          success: false,
          message: "You are not part of this booking",
        });
      }
      await socket.join(roomOf(bookingId));
      joinedBookings(socket)[bookingId] = { userId, role: member.role };
      safeAck(ack, {
        success: true,
        data: {
          bookingId,
          room: roomOf(bookingId),
          role: member.role,
          userId: String(member.booking.userId),
          driverId: member.booking.driverId
            ? String(member.booking.driverId)
            : null,
        },
      });
    } catch (error: any) {
      errorLogger.error(`booking:join failed: ${error?.message || error}`);
      safeAck(ack, { success: false, message: "Unable to join booking" });
    }
  });
  socket.on("booking:leave", async (payload, ack: Ack) => {
    try {
      const bookingId = payload?.bookingId as string | undefined;
      if (bookingId) {
        await socket.leave(roomOf(bookingId));
        delete joinedBookings(socket)[bookingId];
      }
      safeAck(ack, { success: true });
    } catch (error: any) {
      errorLogger.error(`booking:leave failed: ${error?.message || error}`);
      safeAck(ack, { success: false, message: "Unable to leave booking" });
    }
  });
  socket.on("location:share", (payload, ack: Ack) => {
    try {
      const { bookingId, lat, lng, heading, speed } = payload || {};
      const joined = bookingId ? joinedBookings(socket)[bookingId] : undefined;
      if (!joined) {
        return safeAck(ack, {
          success: false,
          message: "Join the booking first",
        });
      }
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (
        !Number.isFinite(latNum) ||
        latNum < -90 ||
        latNum > 90 ||
        !Number.isFinite(lngNum) ||
        lngNum < -180 ||
        lngNum > 180
      ) {
        return safeAck(ack, { success: false, message: "Invalid lat/lng" });
      }
      socket.to(roomOf(bookingId)).emit("location:share", {
        bookingId,
        fromUserId: joined.userId,
        role: joined.role,
        location: {
          lat: latNum,
          lng: lngNum,
          heading: heading ?? null,
          speed: speed ?? null,
          updatedAt: Date.now(),
        },
      });
      safeAck(ack, { success: true });
    } catch (error: any) {
      errorLogger.error(`location:share failed: ${error?.message || error}`);
      safeAck(ack, { success: false, message: "Unable to share location" });
    }
  });
};
