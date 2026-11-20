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
import {
  getDispatcherAllowedSet,
  setDispatcherRoutes,
} from "../../../helpers/dispatcherRouteCache";
import { findInvalidDispatcherRoutes } from "../../../util/permissionRouteList";
import QueryBuilder from "../../builder/queryBuilder";

// Public signup: only riders and drivers can self-register.
const SIGNUP_ROLES: string[] = [USER_ROLES.USER, USER_ROLES.DRIVER];

// Fields a person may set on public signup. Everything else
// (verified, isAdminVerifiedDriver, isBanned, accessScope, applicationStatus,
// trip, stripe ids, …) is ignored and falls back to the schema defaults.
const SIGNUP_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "contact",
  "email",
  "password",
  "role",
  "location",
  "county",
  "authorizationID",
] as const;

const DRIVER_DATA_FIELDS = [
  "driverExperience",
  "licenseNumber",
  "licenseClass",
  "expirationDate",
  "licenseImage",
] as const;

// Fields a logged-in user may change on their own profile.
const PROFILE_UPDATE_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "contact",
  "location",
  "profile",
  "isPushNotificationEnabled",
] as const;

// Fields an admin/dispatcher may set when creating a driver.
const ADMIN_DRIVER_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "contact",
  "email",
  "password",
  "location",
  "county",
] as const;

const pickFields = <T extends Record<string, any>>(
  source: T | undefined,
  fields: readonly string[],
) => {
  const result: Record<string, unknown> = {};
  if (!source || typeof source !== "object") return result;
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
};

const createUserToDB = async (payload: Partial<IUser>): Promise<IUser> => {
  if (!payload.role || !SIGNUP_ROLES.includes(payload.role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Role must be USER or DRIVER",
    );
  }

  const safePayload: Record<string, unknown> = pickFields(
    payload,
    SIGNUP_FIELDS,
  );
  if (payload.role === USER_ROLES.DRIVER && payload.driverData) {
    safePayload.driverData = pickFields(payload.driverData, DRIVER_DATA_FIELDS);
  }

  const createUser = await User.create(safePayload);
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

  // Only profile fields. role, email, password, verified, isBanned,
  // isAdminVerifiedDriver, accessScope, driverData, stripe ids… are ignored.
  // Dispatchers can't change their middleName (it is their role label in system logs).
  const allowedFields =
    isExistUser.role === USER_ROLES.DISPATCHER
      ? PROFILE_UPDATE_FIELDS.filter((field) => field !== "middleName")
      : PROFILE_UPDATE_FIELDS;
  const safePayload = pickFields(payload, allowedFields);

  const updateDoc = await User.findOneAndUpdate({ _id: id }, safePayload, {
    new: true,
    runValidators: true,
  });
  return updateDoc;
};

// driver list
const PUBLIC_DRIVER_FIELDS =
  "firstName middleName lastName profile trip isOnDuty location";

const getAllDriversFromDB = async (
  query: Record<string, any>,
  actor?: JwtPayload,
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

  // Riders only see public driver info; admins/dispatchers see everything.
  const baseQuery = User.find(filter);
  if (actor?.role === USER_ROLES.USER) {
    baseQuery.select(PUBLIC_DRIVER_FIELDS);
  }

  const qb = new QueryBuilder(baseQuery, restQuery).filter().paginate();
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
  qb.modelQuery = qb.modelQuery.populate({
    path: "county",
    select: "name programName",
  });

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

// A dispatcher can only hand out routes they have themselves.
const assertScopeWithinActor = async (actor: JwtPayload, routes: string[]) => {
  if (actor?.role === USER_ROLES.SUPER_ADMIN) return;
  const actorScope = new Set(await getDispatcherAllowedSet(String(actor?.id)));
  const notAllowed = routes.filter((route) => !actorScope.has(route));
  if (notAllowed.length) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      `You can't grant routes you don't have: ${notAllowed.join(", ")}`,
    );
  }
};

const createDispatcherAsAdminIntoDB = async (
  payload: Partial<IUser>,
  actor: JwtPayload,
) => {
  if (!payload.accessScope) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Access scope is required!");
  }
  const accessScope = normalizeAllowedRoutes(payload.accessScope);
  await assertScopeWithinActor(actor, accessScope);
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
  actor: JwtPayload,
) => {
  const routes = normalizeAllowedRoutes(accessScope);
  if (actor?.role !== USER_ROLES.SUPER_ADMIN) {
    if (String(actor?.id) === String(dispatcherId)) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can't change your own access scope",
      );
    }
    await assertScopeWithinActor(actor, routes);
  }
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

const createDriverAsAdminIntoDB = async (payload: IUser) => {
  // role is always DRIVER here — never taken from the body.
  const result = await User.create({
    ...pickFields(payload, ADMIN_DRIVER_FIELDS),
    driverData: pickFields(payload.driverData, DRIVER_DATA_FIELDS),
    role: USER_ROLES.DRIVER,
    verified: true,
    isAdminVerifiedDriver: true,
    applicationStatus: "approved",
  });
  if (!result) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to create driver");
  }
  // send email
  const createAccountTemplate = emailTemplate.driverCreated({
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

const bannedUserAndDriverFromDB = async (id: string) => {
  const isExistUser = await User.findById(id).lean().select("isBanned role");
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }
  if (isExistUser.role === USER_ROLES.SUPER_ADMIN) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      " Super admin can't be banned!",
    );
  }
  const user = await User.findByIdAndUpdate(
    id,
    { isBanned: !isExistUser.isBanned },
    { new: true },
  );
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }
  return user;
};

type DriverApplicationUpdate = Partial<
  Pick<
    IUser,
    | "firstName"
    | "middleName"
    | "lastName"
    | "dateOfBirth"
    | "contact"
    | "location"
  >
> & {
  driverData?: Partial<NonNullable<IUser["driverData"]>>;
  deletedLicenseImages?: string[];
  newLicenseImages?: string[];
};

// update the authenticated driver's pending application
const updateDriverApplicationIntoDB = async (
  user: JwtPayload,
  payload: DriverApplicationUpdate,
) => {
  const driver = await User.findOne({
    _id: user.id,
    role: USER_ROLES.DRIVER,
  });

  if (!driver) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Driver application not found!");
  }

  const deletedImages = Array.isArray(payload.deletedLicenseImages)
    ? new Set(
        payload.deletedLicenseImages.filter(
          (image) => typeof image === "string",
        ),
      )
    : new Set<string>();
  const existingImages = (driver.driverData?.licenseImage ?? []).filter(
    (image) => !deletedImages.has(image),
  );
  const newImages = Array.isArray(payload.newLicenseImages)
    ? payload.newLicenseImages.filter((image) => typeof image === "string")
    : [];
  const licenseImage = [...new Set([...existingImages, ...newImages])];

  if (licenseImage.length > 10) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "A maximum of 10 license images is allowed",
    );
  }

  const {
    deletedLicenseImages: _deletedLicenseImages,
    newLicenseImages: _newLicenseImages,
    driverData,
    ...personalData
  } = payload;
  const currentDriverData = driver.toObject().driverData;

  const result = await User.findByIdAndUpdate(
    driver._id,
    {
      $set: {
        ...personalData,
        driverData: {
          ...currentDriverData,
          ...driverData,
          licenseImage,
        },
      },
    },
    { new: true, runValidators: true },
  );

  if (!result) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Failed to update driver application",
    );
  }
  return result;
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
  createDriverAsAdminIntoDB,
  bannedUserAndDriverFromDB,
  updateDriverApplicationIntoDB,
};
