import { Types } from "mongoose";
import { driverDutyQueue } from "../../../queue/driverduty.queue";
import { User } from "../user/user.model";
import {
  loadDutyState,
  markDriverClean,
  markDriverDirty,
  peekDutyState,
  presentDutyDay,
  saveDutyState,
  syncStateFlags,
  withDutyLock,
} from "./driverduty.cache";
import {
  DRIVER_DUTY_FLUSH_DELAY_MS,
  FLUSH_DRIVER_DUTY_JOB,
} from "./driverduty.constants";
import { IDutyDayCache, IDutyStateCache } from "./driverduty.interface";
import { DriverDuty } from "./driverduty.model";
import { getDutyDate, getDurationMs } from "./driverduty.utils";

const flushJobId = (driverId: string) => `driver-duty-flush-${driverId}`;

export const scheduleDutyFlush = async (driverId: string) => {
  const jobId = flushJobId(driverId);
  const existing = await driverDutyQueue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === "delayed" || state === "waiting" || state === "prioritized") {
      try {
        await existing.changeDelay(DRIVER_DUTY_FLUSH_DELAY_MS);
        return;
      } catch {
        await existing.remove().catch(() => undefined);
      }
    } else if (state === "active") {
      return;
    } else {
      await existing.remove().catch(() => undefined);
    }
  }

  try {
    await driverDutyQueue.add(
      FLUSH_DRIVER_DUTY_JOB,
      { driverId },
      {
        jobId,
        delay: DRIVER_DUTY_FLUSH_DELAY_MS,
      },
    );
  } catch (error: any) {
    if (!String(error?.message ?? "").includes("already exists")) {
      throw error;
    }
  }
};

const emptyDay = (date: string): IDutyDayCache => ({
  date,
  sessions: [],
  totalDurationMs: 0,
  isOnDuty: false,
  dirty: true,
});

const syncUserOnDuty = (driverId: string, isOnDuty: boolean) =>
  User.updateOne({ _id: new Types.ObjectId(driverId) }, { isOnDuty }).catch(
    () => undefined,
  );

const applyToggle = (state: IDutyStateCache, now = new Date()) => {
  const today = getDutyDate(now);
  const openDay = Object.values(state.days).find((day) =>
    day.sessions.some((session) => !session.endTime),
  );

  if (openDay) {
    const openSession = openDay.sessions.find((session) => !session.endTime);
    if (openSession) {
      openSession.endTime = now.toISOString();
      openSession.durationMs = getDurationMs(
        new Date(openSession.startTime),
        now,
      );
      openDay.totalDurationMs += openSession.durationMs;
    }
    openDay.dirty = true;
    syncStateFlags(state);
    return { action: "off" as const, day: openDay };
  }

  const day = state.days[today] ?? emptyDay(today);
  day.sessions.push({
    startTime: now.toISOString(),
    endTime: null,
    durationMs: 0,
  });
  day.dirty = true;
  state.days[today] = day;
  syncStateFlags(state);
  return { action: "on" as const, day };
};

export const applyDutyToggleInCache = async (driverId: string) => {
  const result = await withDutyLock(driverId, async () => {
    const state = await loadDutyState(driverId);
    const { action, day } = applyToggle(state);
    state.version += 1;
    state.updatedAt = Date.now();
    await saveDutyState(state);
    await markDriverDirty(driverId);
    await syncUserOnDuty(driverId, state.isOnDuty);

    return {
      action,
      duty: presentDutyDay(driverId, day),
    };
  });

  try {
    await scheduleDutyFlush(driverId);
  } catch {
    await flushDutyToDB(driverId);
  }

  return result;
};

const dayToMongo = (day: IDutyDayCache) => ({
  sessions: day.sessions.map((session) => ({
    startTime: new Date(session.startTime),
    endTime: session.endTime ? new Date(session.endTime) : null,
    durationMs: session.durationMs,
  })),
  totalDurationMs: day.totalDurationMs,
  isOnDuty: day.isOnDuty,
});

export const flushDutyToDB = async (driverId: string) => {
  const state = await peekDutyState(driverId);
  if (!state) {
    await markDriverClean(driverId);
    return { flushed: 0 };
  }

  const dirtyDays = Object.values(state.days).filter((day) => day.dirty);
  if (!dirtyDays.length) {
    await markDriverClean(driverId);
    return { flushed: 0 };
  }

  const id = new Types.ObjectId(driverId);

  await Promise.all(
    dirtyDays.map((day) =>
      DriverDuty.findOneAndUpdate(
        { driverId: id, date: day.date },
        {
          $set: dayToMongo(day),
          $setOnInsert: { driverId: id, date: day.date },
        },
        { upsert: true, new: true },
      ),
    ),
  );

  let rescheduled = false;
  await withDutyLock(driverId, async () => {
    const latest = await peekDutyState(driverId);
    if (!latest) {
      await markDriverClean(driverId);
      return;
    }

    if (latest.version !== state.version) {
      rescheduled = true;
      await syncUserOnDuty(driverId, latest.isOnDuty);
      return;
    }

    const flushedDates = new Set(dirtyDays.map((day) => day.date));
    for (const day of Object.values(latest.days)) {
      if (flushedDates.has(day.date)) {
        day.dirty = false;
      }
    }

    const stillDirty = Object.values(latest.days).some((day) => day.dirty);
    if (!stillDirty) {
      await markDriverClean(driverId);
    }
    await saveDutyState(latest);
    await syncUserOnDuty(driverId, latest.isOnDuty);
  });

  if (rescheduled) {
    await scheduleDutyFlush(driverId);
  }

  return { flushed: dirtyDays.length, rescheduled };
};
