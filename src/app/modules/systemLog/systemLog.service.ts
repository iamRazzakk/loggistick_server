import { JwtPayload } from "jsonwebtoken";
import { USER_ROLES } from "../../../enums/user";
import QueryBuilder from "../../builder/queryBuilder";
import { ISystemLog, SystemLogChange } from "./systemLog.interface";
import { SystemLog } from "./systemLog.model";
import { User } from "../user/user.model";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

// actorRole filter: "SUPER_ADMIN", "DISPATCHER" (all dispatchers),
// or a dispatcher middleName (only dispatchers with that middleName).
const buildActorRoleFilter = async (actorRole: string) => {
  if (actorRole === USER_ROLES.SUPER_ADMIN || actorRole === USER_ROLES.DISPATCHER) {
    return { actorRole };
  }
  const dispatchers = await User.find({
    role: USER_ROLES.DISPATCHER,
    middleName: {
      $regex: `^\\s*${escapeRegex(actorRole.trim())}\\s*$`,
      $options: "i",
    },
  })
    .select("_id")
    .lean();
  return {
    actorRole: USER_ROLES.DISPATCHER,
    actorId: { $in: dispatchers.map((d) => d._id) },
  };
};

const getSystemLogsFromDB = async (query: Record<string, unknown>) => {
  const { actorRole: actorRoleQuery, ...restQuery } = query;
  const baseFilter =
    typeof actorRoleQuery === "string" && actorRoleQuery.trim()
      ? await buildActorRoleFilter(actorRoleQuery.trim())
      : {};

  const qb = new QueryBuilder(
    SystemLog.find(baseFilter).populate(
      "actorId",
      "firstName middleName lastName email role",
    ),
    restQuery,
  )
    .filter()
    .sort()
    .paginate();

  if (!query.sort) qb.modelQuery.sort({ createdAt: -1 });
  const [logs, meta] = await Promise.all([
    qb.modelQuery.lean().exec(),
    qb.getPaginationInfo(),
  ]);

  // Admin → "SUPER_ADMIN"; dispatcher → their middleName (falls back to "DISPATCHER").
  // middleName is only used for the role; the actor object shows first + last name.
  type PopulatedLog = Omit<ISystemLog, "actorId" | "actorRole"> & {
    actorRole: string;
    actorId: ({ middleName?: string } & Record<string, unknown>) | null;
  };
  const data = (logs as unknown as PopulatedLog[]).map((log) => {
    const { middleName, ...actor } = log.actorId ?? {};
    const actorRole =
      log.actorRole === USER_ROLES.DISPATCHER
        ? middleName?.trim() || USER_ROLES.DISPATCHER
        : log.actorRole;
    return { ...log, actorId: log.actorId ? actor : null, actorRole };
  });

  return { data, meta };
};

// Options for the "Actor role" filter: SUPER_ADMIN + each dispatcher middleName.
const getActorRoleOptionsFromDB = async () => {
  const middleNames: (string | null)[] = await User.distinct("middleName", {
    role: USER_ROLES.DISPATCHER,
  });
  const names = new Map<string, string>();
  for (const name of middleNames) {
    const trimmed = name?.trim();
    if (trimmed && !names.has(trimmed.toLowerCase())) {
      names.set(trimmed.toLowerCase(), trimmed);
    }
  }
  // Dispatchers without a middleName show up as "DISPATCHER" in the logs
  const hasUnnamed = await User.exists({
    role: USER_ROLES.DISPATCHER,
    $or: [
      { middleName: { $exists: false } },
      { middleName: null },
      { middleName: { $regex: "^\\s*$" } },
    ],
  });
  return [
    USER_ROLES.SUPER_ADMIN,
    ...[...names.values()].sort((a, b) => a.localeCompare(b)),
    ...(hasUnnamed ? [USER_ROLES.DISPATCHER] : []),
  ];
};

export const SystemLogServices = {
  createSystemLogIntoDB,
  getSystemLogsFromDB,
  getActorRoleOptionsFromDB,
};
