import { JwtPayload } from "jsonwebtoken";
import { USER_ROLES } from "../../../enums/user";
import QueryBuilder from "../../builder/queryBuilder";
import { SystemLogChange } from "./systemLog.interface";
import { SystemLog } from "./systemLog.model";

const AUDIT_ROLES = new Set<string>([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.DISPATCHER,
]);

const comparable = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toString" in value) {
    const stringValue = String(value);
    if (stringValue !== "[object Object]") return stringValue;
  }
  return value;
};

export const collectSystemLogChanges = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): SystemLogChange[] =>
  [...new Set(fields)].flatMap((field) => {
    const oldValue = comparable(before[field]);
    const newValue = comparable(after[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? []
      : [{ field, before: oldValue, after: newValue }];
  });

type CreateSystemLogInput = {
  actor: JwtPayload;
  action: "CREATE" | "UPDATE" | "DELETE";
  module: string;
  entityType: string;
  entityId: string;
  description: string;
  changes?: SystemLogChange[];
  metadata?: Record<string, unknown>;
};

const createSystemLogIntoDB = async (input: CreateSystemLogInput) => {
  if (!AUDIT_ROLES.has(input.actor.role)) return null;
  if (input.action === "UPDATE" && !input.changes?.length) return null;

  return SystemLog.create({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    actorEmail: input.actor.email,
    action: input.action,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    description: input.description,
    changes: input.changes ?? [],
    metadata: input.metadata,
  });
};

const getSystemLogsFromDB = async (query: Record<string, unknown>) => {
  const qb = new QueryBuilder(
    SystemLog.find().populate("actorId", "firstName middleName lastName email role"),
    query,
  )
    .filter()
    .sort()
    .paginate();

  if (!query.sort) qb.modelQuery.sort({ createdAt: -1 });
  const [data, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

export const SystemLogServices = {
  createSystemLogIntoDB,
  getSystemLogsFromDB,
};
