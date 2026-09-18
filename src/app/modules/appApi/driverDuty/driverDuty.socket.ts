import { Server, Socket } from "socket.io";
import { JwtPayload } from "jsonwebtoken";
import { USER_ROLES } from "../../../../enums/user";
import { DriverDutyValidations } from "./driverDuty.validation";
import { DriverDutyService } from "./driverDuty.service";
import { errorLogger, logger } from "../../../../shared/logger";

type Ack = (payload: {
  success: boolean;
  message?: string;
  data?: unknown;
}) => void;

const bookingRoom = (bookingId: string) => `booking:${bookingId}`;

const safeAck = (ack: Ack | undefined, payload: Parameters<Ack>[0]) => {
  if (typeof ack === "function") ack(payload);
};

const emitLive = async (
  io: Server,
  targets: { bookingId: string; userId: string }[],
  event: string,
  data: unknown,
) => {
  if (!targets.length) {
    logger.warn(`live emit ${event} skipped: no assigned/in-progress/confirmed booking`);
    return;
  }

  for (const { bookingId, userId } of targets) {
    const payload = { ...(data as object), bookingId };
    const sent = new Set<string>();
    const rooms = [bookingRoom(bookingId), `user:${userId}`];

    for (const room of rooms) {
      const sockets = await io.in(room).fetchSockets();
      for (const sock of sockets) {
        if (sent.has(sock.id)) continue;
        sent.add(sock.id);
        sock.emit(event, payload);
      }
    }
  }
};

const hydrateSocketTracking = async (socket: Socket) => {
  const user = socket.data.user as JwtPayload | undefined;
  if (!user?.id) return;

  try {
    const bookings = await DriverDutyService.getTrackingBookingsForUser(user.id);
    for (const booking of bookings) {
      const bookingId = String(booking._id);
      await socket.join(bookingRoom(bookingId));
      if (!booking.driverId) continue;

      const liveTracking = await DriverDutyService.readDriverLiveTracking(
        String(booking.driverId),
      );
      socket.emit("location:update", {
        driverId: String(booking.driverId),
        bookingId,
        ...liveTracking,
      });
    }
  } catch (error: any) {
    errorLogger.error(`hydrate tracking failed: ${error?.message || error}`);
  }
};

const requireDriver = (socket: Socket, ack?: Ack) => {
  const user = socket.data.user as JwtPayload | undefined;
  if (!user?.id) {
    safeAck(ack, { success: false, message: "Unauthorized" });
    return null;
  }
  if (user.role !== USER_ROLES.DRIVER && user.role !== USER_ROLES.SUPER_ADMIN) {
    safeAck(ack, { success: false, message: "Only drivers can emit location" });
    return null;
  }
  return user;
};

export const registerDriverDutySocket = (io: Server, socket: Socket) => {
  socket.on("duty:toggle", async (payload, ack: Ack) => {
    const user = requireDriver(socket, ack);
    if (!user) return;

    const parsed = DriverDutyValidations.toggleDutyZodSchema.safeParse({
      body: payload,
    });
    if (!parsed.success) {
      safeAck(ack, {
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid duty payload",
      });
      return;
    }

    try {
      const result = await DriverDutyService.toggleDuty(user, parsed.data.body);
      socket.data.isOnDuty = result.isOnDuty;

      await emitLive(
        io,
        result.targets,
        result.isOnDuty ? "location:update" : "duty:changed",
        {
          driverId: user.id,
          isOnDuty: result.isOnDuty,
          isStale: false,
          isFallback: result.isFallback,
          location: result.location,
        },
      );

      safeAck(ack, { success: true, data: result });
    } catch (error: any) {
      errorLogger.error(`duty:toggle failed: ${error?.message || error}`);
      safeAck(ack, {
        success: false,
        message: error?.message || "Unable to toggle duty",
      });
    }
  });

  socket.on("location:update", async (payload, ack: Ack) => {
    const user = requireDriver(socket, ack);
    if (!user) return;

    const parsed = DriverDutyValidations.updateLocationZodSchema.safeParse({
      body: payload,
    });
    if (!parsed.success) {
      safeAck(ack, {
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid location payload",
      });
      return;
    }

    try {
      const result = await DriverDutyService.updateLocation(
        user,
        parsed.data.body,
      );

      await emitLive(io, result.targets, "location:update", {
        driverId: user.id,
        isOnDuty: true,
        isStale: false,
        isFallback: result.isFallback,
        location: result.location,
      });

      safeAck(ack, { success: true, data: { updatedAt: result.location.updatedAt } });
    } catch (error: any) {
      errorLogger.error(`location:update failed: ${error?.message || error}`);
      safeAck(ack, {
        success: false,
        message: error?.message || "Unable to update location",
      });
    }
  });

  socket.on("booking:join", async (payload, ack: Ack) => {
    const user = socket.data.user as JwtPayload | undefined;
    if (!user?.id) {
      safeAck(ack, { success: false, message: "Unauthorized" });
      return;
    }

    const bookingId = payload?.bookingId as string | undefined;
    if (!bookingId) {
      safeAck(ack, { success: false, message: "bookingId is required" });
      return;
    }

    try {
      const booking = await DriverDutyService.canJoinBooking(user, bookingId);
      if (!booking) {
        safeAck(ack, {
          success: false,
          message: "You cannot track this booking",
        });
        return;
      }

      await socket.join(bookingRoom(bookingId));
      const liveTracking = await DriverDutyService.readDriverLiveTracking(
        String(booking.driverId),
      );

      socket.emit("location:update", {
        driverId: String(booking.driverId),
        bookingId,
        ...liveTracking,
      });

      safeAck(ack, {
        success: true,
        data: { bookingId, liveTracking },
      });
    } catch (error: any) {
      errorLogger.error(`booking:join failed: ${error?.message || error}`);
      safeAck(ack, {
        success: false,
        message: error?.message || "Unable to join booking",
      });
    }
  });

  socket.on("booking:leave", async (payload, ack: Ack) => {
    const bookingId = payload?.bookingId as string | undefined;
    if (bookingId) {
      await socket.leave(bookingRoom(bookingId));
    }
    safeAck(ack, { success: true });
  });

  void hydrateSocketTracking(socket);
};
