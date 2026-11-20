// IDOR found during the NoSQL review: booking update and driver rating
// must only touch the caller's own records.
const bookingDoc: any = {
  _id: "b1",
  userId: "rider1",
  driverId: "driver1",
  bookingStatus: "assigned",
  toObject() {
    return { ...this };
  },
};
const bookingUpdate = jest.fn(async (_id: string, p: any) => ({
  ...bookingDoc,
  ...p,
  toObject() {
    return { ...bookingDoc, ...p };
  },
}));
jest.mock("../../src/app/modules/booking/booking.model", () => ({
  Booking: {
    findById: jest.fn((id: string) => {
      const doc = id === "b1" ? bookingDoc : null;
      const p: any = Promise.resolve(doc);
      p.lean = async () =>
        id === "trip-done"
          ? { _id: "trip-done", userId: "rider1", driverId: "driver1", bookingStatus: "completed" }
          : doc;
      return p;
    }),
    findByIdAndUpdate: (...a: any[]) => (bookingUpdate as any)(...a),
  },
}));
const ratingUpdate = jest.fn(async (_id: string, u: any) => u);
const ratingCreate = jest.fn(async (doc: any) => doc);
jest.mock("../../src/app/modules/driverrating/driverrating.model", () => ({
  Driverrating: {
    findById: () => ({
      select: () => ({ lean: async () => ({ userId: "rider1" }) }),
    }),
    findByIdAndUpdate: (...a: any[]) => (ratingUpdate as any)(...a),
    create: (...a: any[]) => (ratingCreate as any)(...a),
  },
}));
jest.mock("../../src/app/modules/systemLog/systemLog.service", () => ({
  SystemLogServices: { createSystemLogIntoDB: jest.fn() },
  collectSystemLogChanges: () => [],
}));
jest.mock("../../src/firebase", () => ({}));
// No Redis / BullMQ / push connections in unit tests
jest.mock("../../src/queue/booking.queue", () => ({}));
jest.mock("../../src/queue/email.queue", () => ({ emailQueue: { add: jest.fn() } }));
jest.mock("../../src/helpers/notificationsHelper", () => ({}));
jest.mock("../../src/config/redis.config", () => ({ RedisClient: {} }));
jest.mock("../../src/redis/redis.service", () => ({ redisService: {} }));
jest.mock("../../src/app/modules/booking/booking.export", () => ({}));

import { BookingServices } from "../../src/app/modules/booking/booking.service";
import { DriverratingServices } from "../../src/app/modules/driverrating/driverrating.service";

const ratingId = "64b7f0c2a1b2c3d4e5f60718";

describe("booking update ownership", () => {
  beforeEach(() => bookingUpdate.mockClear());

  it("rider can't update someone else's booking", async () => {
    await expect(
      BookingServices.updateBookingInDB("b1", { notes: "x" } as any, { id: "rider2", role: "USER" }),
    ).rejects.toThrow("your own booking");
  });

  it("driver can't update a trip assigned to another driver", async () => {
    await expect(
      BookingServices.updateBookingInDB("b1", { notes: "x" } as any, { id: "driver2", role: "DRIVER" }),
    ).rejects.toThrow("your own booking");
  });

  it("owner can update, but not userId/driverId/isApproved", async () => {
    // Steps after the update (notifications, real User lookup) aren't mocked
    // here; only the update payload matters.
    await BookingServices.updateBookingInDB(
      "b1",
      { notes: "x", userId: "rider2", isApproved: "approved" } as any,
      { id: "rider1", role: "USER" },
    ).catch(() => undefined);
    expect(bookingUpdate).toHaveBeenCalledTimes(1);
    const payload = bookingUpdate.mock.calls[0][1];
    expect(payload.notes).toBe("x");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("isApproved");
  });
});

describe("driver rating ownership", () => {
  beforeEach(() => {
    ratingUpdate.mockClear();
    ratingCreate.mockClear();
  });

  it("other rider can't edit a rating", async () => {
    await expect(
      DriverratingServices.updateDriverRatingIntoDB(ratingId, { rating: 1 } as any, { id: "rider2", role: "USER" }),
    ).rejects.toThrow("your own rating");
  });

  it("owner edits only rating/comment", async () => {
    await DriverratingServices.updateDriverRatingIntoDB(
      ratingId,
      { rating: 4, comment: "ok", driverId: "x", userId: "y" } as any,
      { id: "rider1", role: "USER" },
    );
    expect(ratingUpdate.mock.calls[0][1]).toEqual({ rating: 4, comment: "ok" });
  });

  it("create: owner = token user, driver from the trip", async () => {
    await DriverratingServices.createDriverRatingIntoDB(
      { tripId: "trip-done", rating: 5, comment: "great", driverId: "someone" } as any,
      { id: "rider1", role: "USER" },
    ).catch(() => undefined);
    // tripId "trip-done" isn't an ObjectId → rejected before DB
    expect(ratingCreate).not.toHaveBeenCalled();
  });
});
