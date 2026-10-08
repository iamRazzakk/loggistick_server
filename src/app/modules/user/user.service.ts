import { IUser } from "./user.interface";
import { JwtPayload } from "jsonwebtoken";
import { User } from "./user.model";
import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import generateOTP from "../../../util/generateOTP";
import { emailTemplate } from "../../../shared/emailTemplate";
import { randomUUID } from "crypto";
import { emailQueue } from "../../../queue/email.queue";
import { redisService } from "../../../redis/redis.service";
import { USER_ROLES } from "../../../enums/user";
import { setDispatcherRoutes } from "../../../helpers/dispatcherRouteCache";
import { findInvalidDispatcherRoutes } from "../../../util/permissionRouteList";
import QueryBuilder from "../../builder/queryBuilder";

const createUserToDB = async (payload: Partial<IUser>): Promise<IUser> => {
  const createUser = await User.create(payload);
  if (!createUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create user");
  }

  //send email
  const otp = generateOTP();
  const values = {
    name: `${createUser.firstName} ${createUser.middleName ? createUser.middleName : ""} ${createUser.lastName}`,
    otp: otp,
    email: createUser.email!,
  };

  const emailJobId = randomUUID();
  const createAccountTemplate = emailTemplate.createAccount(values);
  const emailData = {
    jobId: emailJobId,
    to: createAccountTemplate.to,
    subject: createAccountTemplate.subject,
    html: createAccountTemplate.html,
    type: "create_account",
  };

  //save to redis
  await emailQueue.add("send-email", emailData);
  // store otp to redis
  await redisService.post({
    key: `otp:${createUser.email}`,
    value: Number(otp),
    expiration: 3 * 60, // 3 minutes
  });

  return createUser;
};

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id } = user;
  const isExistUser: any = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }
  return isExistUser;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const { accessScope: _accessScope, ...safePayload } = payload;
  const updateDoc = await User.findOneAndUpdate({ _id: id }, safePayload, {
    new: true,
  });
  return updateDoc;
};

// driver list
const getAllDriversFromDB = async (
  query: Record<string, any>,
): Promise<{ data: Partial<IUser>[]; meta: any }> => {
  const { searchTerm, ...restQuery } = query;
  const term = String(searchTerm ?? "").trim();
  const filter: Record<string, unknown> = {
    role: USER_ROLES.DRIVER,
    isAdminVerifiedDriver: true,
  };

  if (term) {
    const words = term
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .split(/\s+/)
      .filter(Boolean);

    filter.$and = words.map((word) => ({
      $or: ["firstName", "lastName", "middleName", "email", "contact"].map(
        (field) => ({
          [field]: { $regex: word, $options: "i" },
        }),
      ),
    }));
  }

  const qb = new QueryBuilder(User.find(filter), restQuery).filter().paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// rider list
const getAllRidersFromDB = async (
  query: Record<string, any>,
): Promise<{ data: Partial<IUser>[]; meta: any }> => {
  const qb = new QueryBuilder(User.find({ role: USER_ROLES.USER }), query)
    .filter()
    .sort()
    .search(["firstName", "lastName", "middleName", "email", "contact"])
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// driver application list
const getAllDriverApplicationsFromDB = async (
  query: Record<string, any>,
): Promise<{ data: Partial<IUser>[]; meta: any }> => {
  const qb = new QueryBuilder(
    User.find({
      verified: true,
      role: USER_ROLES.DRIVER,
      applicationStatus: "pending",
      isAdminVerifiedDriver: false,
    }),
    query,
  )
    .filter()
    .sort()
    .search(["firstName", "lastName", "middleName", "email", "contact"])
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

// DISPATCHER create

const normalizeAllowedRoutes = (routes: string[] | undefined): string[] => {
  if (!routes) {
    return [];
  }

  const unique = [
    ...new Set(
      routes.map((route) => {
        const trimmed = route.trim();
        return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      }),
    ),
  ];

  const invalid = findInvalidDispatcherRoutes(unique);
  if (invalid.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Invalid dispatcher routes: ${invalid.join(", ")}`,
    );
  }
  return unique;
};

// dispatcher list
const getAllDispatchersFromDB = async (
  query: Record<string, any>,
): Promise<{ data: Partial<IUser>[]; meta: any }> => {
  const qb = new QueryBuilder(User.find({ role: USER_ROLES.DISPATCHER }), query)
    .filter()
    .sort()
    .search(["firstName", "lastName", "middleName", "email", "contact"])
    .paginate();
  const [data, meta] = await Promise.all([
    qb.modelQuery.exec(),
    qb.getPaginationInfo(),
  ]);
  return { data, meta };
};

const createDispatcherAsAdminIntoDB = async (payload: Partial<IUser>) => {
  if (!payload.accessScope) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Access scope is required!");
  }
  const accessScope = normalizeAllowedRoutes(payload.accessScope);
  const result = await User.create({
    firstName: payload.firstName,
    lastName: payload.lastName,
    middleName: payload.middleName,
    email: payload.email,
    password: payload.password,
    accessScope,
    verified: true,
    contact: payload.contact,
    dateOfBirth: new Date(),
    role: USER_ROLES.DISPATCHER,
  });
  setDispatcherRoutes(result._id.toString(), accessScope);
  // send email
  const createAccountTemplate = emailTemplate.dispatcherCreated({
    email: result.email!,
    password: payload.password!,
    firstName: result.firstName,
    lastName: result.lastName,
    middleName: result.middleName ?? "",
  });
  const emailData = {
    jobId: randomUUID(),
    to: createAccountTemplate.to,
    subject: createAccountTemplate.subject,
    html: createAccountTemplate.html,
    type: "create_account",
  };
  await emailQueue.add("send-email", emailData);

  return result;
};

const updateDispatcherRoutesIntoDB = async (
  dispatcherId: string,
  accessScope: string[],
) => {
  const routes = normalizeAllowedRoutes(accessScope);
  const dispatcher = await User.findOneAndUpdate(
    { _id: dispatcherId, role: USER_ROLES.DISPATCHER },
    { accessScope: routes },
    { new: true },
  ).select("firstName lastName email role accessScope");

  if (!dispatcher) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Dispatcher doesn't exist!");
  }

  setDispatcherRoutes(dispatcherId, routes);
  return dispatcher;
};

export const UserService = {
  createUserToDB,
  getUserProfileFromDB,
  updateProfileToDB,
  getAllDriversFromDB,
  getAllRidersFromDB,
  getAllDriverApplicationsFromDB,
  createDispatcherAsAdminIntoDB,
  updateDispatcherRoutesIntoDB,
  getAllDispatchersFromDB,
};
