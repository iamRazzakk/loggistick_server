import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import QueryBuilder from "../../builder/queryBuilder";
import { User } from "../user/user.model";
import {
  listDirtyDrivers,
  peekDutyState,
  presentDutyDay,
  stateIsOnDuty,
} from "./driverduty.cache";
import { DRIVER_POPULATE_FIELDS } from "./driverduty.constants";
import { IDriverDuty, IDutyStateCache } from "./driverduty.interface";
import { DriverDuty } from "./driverduty.model";
import {
  applyDutyToggleInCache,
  flushDutyToDB,
} from "./driverduty.processor";
import { normalizeDutyDate, presentDriverDuty } from "./driverduty.utils";

const syncDirtyDutyToDB = async (driverIds?: string[]) => {
  const ids = driverIds?.length ? driverIds : await listDirtyDrivers();
  if (!ids.length) return;
  await Promise.all(ids.map((id) => flushDutyToDB(id).catch(() => undefined)));
};

const applyDutyDateFilter = (
  filter: Record<string, unknown>,
  query: { date?: unknown; from?: unknown; to?: unknown },
) => {
  const date = normalizeDutyDate(query.date);
  const from = normalizeDutyDate(query.from);
  const to = normalizeDutyDate(query.to);

  if (date) {
    filter.date = date;
    return;
  }

  if (from || to) {
    filter.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
};

const dateInFilter = (date: string, filter: Record<string, unknown>) => {
  const value = filter.date;
  if (!value) return true;
  if (typeof value === "string") return value === date;
  if (typeof value === "object" && value) {
    const range = value as { $gte?: string; $lte?: string };
    if (range.$gte && date < range.$gte) return false;
    if (range.$lte && date > range.$lte) return false;
  }
  return true;
};

const driverRefId = (driverId: unknown) => {
  if (!driverId) return "";
  if (typeof driverId === "object" && driverId && "_id" in driverId) {
    return String((driverId as { _id: unknown })._id);
  }
  return String(driverId);
};

const overlayCachedDays = (
  data: Array<IDriverDuty & { driverId?: unknown }>,
  states: Map<string, IDutyStateCache>,
  filter: Record<string, unknown>,
) => {
  if (!states.size) {
    return data.map((duty) => presentDriverDuty(duty));
  }

  const presented = data.map((duty) => {
    const id = driverRefId(duty.driverId);
    const cached = states.get(id)?.days[duty.date];
    if (cached) {
      return {
        ...presentDutyDay(id, cached),
        driverId: duty.driverId,
      };
    }
    return presentDriverDuty(duty);
  });

  for (const [id, state] of states) {
    for (const day of Object.values(state.days)) {
      if (!dateInFilter(day.date, filter)) continue;
      const already = presented.some(
        (item) => item.date === day.date && driverRefId(item.driverId) === id,
      );
      if (already) continue;
      presented.push(presentDutyDay(id, day));
    }
  }

  return presented.sort((a, b) => (a.date < b.date ? 1 : -1));
};

const needsDriverProfile = (driverId: unknown) => {
  if (!driverId) return false;
  if (typeof driverId === "string") return true;
  return typeof driverId === "object" && !("firstName" in driverId);
};

const attachDriverProfiles = async (
  logs: ReturnType<typeof overlayCachedDays>,
) => {
  const missingIds = [
    ...new Set(
      logs
        .filter((log) => needsDriverProfile(log.driverId))
        .map((log) => driverRefId(log.driverId))
        .filter((id) => Types.ObjectId.isValid(id)),
    ),
  ];

  if (!missingIds.length) return logs;

  const drivers = await User.find({ _id: { $in: missingIds } })
    .select(DRIVER_POPULATE_FIELDS)
    .lean();
  const byId = new Map(drivers.map((driver) => [String(driver._id), driver]));

  return logs.map((log) => {
    const id = driverRefId(log.driverId);
    const profile = byId.get(id);
    return profile ? { ...log, driverId: profile } : log;
  });
};

const loadStates = async (driverIds: string[]) => {
  const unique = [...new Set(driverIds.filter(Boolean))];
  const states = new Map<string, IDutyStateCache>();
  await Promise.all(
    unique.map(async (id) => {
      const state = await peekDutyState(id);
      if (state) states.set(id, state);
    }),
  );
  return states;
};

const parseDriverId = (driverId: unknown) => {
  const value = String(driverId ?? "").trim();
  if (!value) return undefined;
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid driverId");
  }
  return value;
};

const toggleDutyIntoDB = async (user: JwtPayload) =>
  applyDutyToggleInCache(String(user.id));

const getCurrentDutyFromDB = async (user: JwtPayload) => {
  const driverId = String(user.id);
  const cached = await peekDutyState(driverId);
  if (cached) {
    return { isOnDuty: stateIsOnDuty(cached) };
  }

  const isOnDuty = await DriverDuty.exists({
    driverId: new Types.ObjectId(driverId),
    sessions: { $elemMatch: { endTime: null } },
  });

  return { isOnDuty: Boolean(isOnDuty) };
};

const getMyDutyHistoryFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const driverId = new Types.ObjectId(user.id);
  const { date, from, to, driverId: _ignored, ...restQuery } = query;
  const filter: Record<string, unknown> = { driverId };
  applyDutyDateFilter(filter, { date, from, to });

  await syncDirtyDutyToDB([String(user.id)]);

  const qb = new QueryBuilder(DriverDuty.find(filter), {
    sort: "-date",
    ...restQuery,
  })
    .filter()
    .sort()
    .paginate();

  const [data, meta, states] = await Promise.all([
    qb.modelQuery.lean<IDriverDuty[]>().exec(),
    qb.getPaginationInfo(),
    loadStates([String(user.id)]),
  ]);

  return {
    data: overlayCachedDays(data, states, filter),
    meta,
  };
};

const getDutyLogsFromDB = async (query: Record<string, unknown>) => {
  const { date, from, to, driverId, ...restQuery } = query;
  const parsedDriverId = parseDriverId(driverId);
  const filter: Record<string, unknown> = {};

  if (parsedDriverId) {
    filter.driverId = new Types.ObjectId(parsedDriverId);
  }
  applyDutyDateFilter(filter, { date, from, to });

  await syncDirtyDutyToDB(parsedDriverId ? [parsedDriverId] : undefined);

  const qb = new QueryBuilder(DriverDuty.find(filter), {
    sort: "-date",
    ...restQuery,
  })
    .filter()
    .sort()
    .paginate()
    .populate(["driverId"], { driverId: DRIVER_POPULATE_FIELDS });

  const [data, meta] = await Promise.all([
    qb.modelQuery.lean<IDriverDuty[]>().exec(),
    qb.getPaginationInfo(),
  ]);

  const pageDriverIds = data.map((duty) => driverRefId(duty.driverId));
  const extraIds = parsedDriverId
    ? [parsedDriverId]
    : await listDirtyDrivers();
  const states = await loadStates([...pageDriverIds, ...extraIds]);
  const logs = overlayCachedDays(data, states, filter);
  const populated = await attachDriverProfiles(logs);

  return {
    data: populated,
    meta,
  };
};

export const DriverDutyServices = {
  toggleDutyIntoDB,
  getCurrentDutyFromDB,
  getMyDutyHistoryFromDB,
  getDutyLogsFromDB,
};
