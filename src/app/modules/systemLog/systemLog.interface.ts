import { Types } from "mongoose";
import { USER_ROLES } from "../../../enums/user";

export type SystemLogChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ISystemLog = {
  actorId: Types.ObjectId;
  actorRole: USER_ROLES.SUPER_ADMIN | USER_ROLES.DISPATCHER;
  actorEmail?: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  module: string;
  entityType: string;
  entityId: string;
  description: string;
  changes: SystemLogChange[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
