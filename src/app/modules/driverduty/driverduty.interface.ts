import { Model, Types } from "mongoose";

export type IDutySession = {
  startTime: Date;
  endTime: Date | null;
  durationMs: number;
};

export type IDriverDuty = {
  driverId: Types.ObjectId;
  date: string;
  sessions: IDutySession[];
  totalDurationMs: number;
  isOnDuty: boolean;
};

export type IDutyDuration = {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  formatted: string;
};

export type IPresentedDutySession = {
  startTime: Date;
  endTime: Date | null;
  duration: IDutyDuration;
};

export type IPresentedDriverDuty = {
  _id?: Types.ObjectId;
  driverId: Types.ObjectId;
  date: string;
  isOnDuty: boolean;
  firstStartTime: Date | null;
  lastEndTime: Date | null;
  sessions: IPresentedDutySession[];
  totalDuration: IDutyDuration;
};

export type IDutySessionCache = {
  startTime: string;
  endTime: string | null;
  durationMs: number;
};

export type IDutyDayCache = {
  date: string;
  sessions: IDutySessionCache[];
  totalDurationMs: number;
  isOnDuty: boolean;
  dirty: boolean;
};

export type IDutyStateCache = {
  driverId: string;
  days: Record<string, IDutyDayCache>;
  isOnDuty: boolean;
  version: number;
  updatedAt: number;
};

export type DriverDutyModel = Model<IDriverDuty>;
