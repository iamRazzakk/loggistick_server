import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import redisClient from "../../../config/redis.config";
import ApiError from "../../../errors/ApiErrors";
import {
  DRIVER_DUTY_CACHE_TTL,
  DUTY_DIRTY_SET,
  dutyCacheKey,
  dutyLockKey,
} from "./driverduty.constants";
import {
  IDriverDuty,
  IDutyDayCache,
  IDutySessionCache,
  IDutyStateCache,
} from "./driverduty.interface";
import { DriverDuty } from "./driverduty.model";
import { getDutyDate, presentDriverDuty } from "./driverduty.utils";

const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toSessionCache = (session: {
  startTime: Date | string;
  endTime?: Date | string | null;
  durationMs?: number;
}): IDutySessionCache => ({
  startTime: new Date(session.startTime).toISOString(),
  endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
  durationMs: session.durationMs || 0,
});

export const toDutyDayCache = (
  duty: Pick<IDriverDuty, "date" | "sessions" | "totalDurationMs" | "isOnDuty">,
  dirty = false,
): IDutyDayCache => ({
  date: duty.date,
  sessions: (duty.sessions ?? []).map(toSessionCache),
  totalDurationMs: duty.totalDurationMs || 0,
  isOnDuty: Boolean(duty.isOnDuty),
  dirty,
});

export const stateIsOnDuty = (state: IDutyStateCache) =>
  Object.values(state.days).some((day) =>
    day.sessions.some((session) => !session.endTime),
  );

export const syncStateFlags = (state: IDutyStateCache) => {
  for (const day of Object.values(state.days)) {
    day.isOnDuty = day.sessions.some((session) => !session.endTime);
  }
  state.isOnDuty = stateIsOnDuty(state);
  return state;
};

export const presentDutyDay = (driverId: string, day: IDutyDayCache) =>
  presentDriverDuty({
    driverId: new Types.ObjectId(driverId),
    date: day.date,
    sessions: day.sessions.map((session) => ({
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      durationMs: session.durationMs,
    })),
    totalDurationMs: day.totalDurationMs,
    isOnDuty: day.isOnDuty,
  });

export const isDriverOnDuty = async (driverId: string) => {
  const cached = await peekDutyState(driverId);
  if (cached) return stateIsOnDuty(cached);

  const open = await DriverDuty.exists({
    driverId: new Types.ObjectId(driverId),
    sessions: { $elemMatch: { endTime: null } },
  });
  return Boolean(open);
};

export const peekDutyState = async (
  driverId: string,
): Promise<IDutyStateCache | null> => {
  const raw = await redisClient.get(dutyCacheKey(driverId));
  if (!raw) return null;
  return syncStateFlags(JSON.parse(raw) as IDutyStateCache);
};

export const saveDutyState = async (state: IDutyStateCache) => {
  syncStateFlags(state);
  await redisClient.set(
    dutyCacheKey(state.driverId),
    JSON.stringify(state),
    "EX",
    DRIVER_DUTY_CACHE_TTL,
  );
};

export const markDriverDirty = (driverId: string) =>
  redisClient.sadd(DUTY_DIRTY_SET, driverId);

export const markDriverClean = (driverId: string) =>
  redisClient.srem(DUTY_DIRTY_SET, driverId);

export const listDirtyDrivers = () => redisClient.smembers(DUTY_DIRTY_SET);

const hydrateDutyState = async (driverId: string): Promise<IDutyStateCache> => {
  const id = new Types.ObjectId(driverId);
  const today = getDutyDate();
  const [openDuty, todayDuty] = await Promise.all([
    DriverDuty.findOne({
      driverId: id,
      sessions: { $elemMatch: { endTime: null } },
    }).lean(),
    DriverDuty.findOne({ driverId: id, date: today }).lean(),
  ]);

  const days: Record<string, IDutyDayCache> = {};
  for (const duty of [openDuty, todayDuty]) {
    if (!duty) continue;
    days[duty.date] = toDutyDayCache(duty, false);
  }

  return syncStateFlags({
    driverId,
    days,
    isOnDuty: false,
    version: 0,
    updatedAt: Date.now(),
  });
};

export const loadDutyState = async (driverId: string) => {
  const cached = await peekDutyState(driverId);
  if (cached) return cached;

  const state = await hydrateDutyState(driverId);
  await saveDutyState(state);
  return state;
};

export const withDutyLock = async <T>(
  driverId: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const key = dutyLockKey(driverId);
  const token = randomUUID();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const locked = await redisClient.set(key, token, "EX", 10, "NX");
    if (locked) {
      try {
        return await fn();
      } finally {
        await redisClient.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
      }
    }
    await sleep(40 + attempt * 30);
  }

  throw new ApiError(
    StatusCodes.CONFLICT,
    "Duty is updating. Please try again.",
  );
};

export const currentDutyDay = (
  state: IDutyStateCache,
  today = getDutyDate(),
) => {
  const openDay = Object.values(state.days).find((day) =>
    day.sessions.some((session) => !session.endTime),
  );
  return openDay ?? state.days[today] ?? null;
};
