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

  //save to DB
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

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });
  return updateDoc;
};

// driver list
const getAllDriversFromDB = async (
  query: Record<string, any>,
): Promise<{ data: Partial<IUser>[]; meta: any }> => {
  const qb = new QueryBuilder(User.find({ role: USER_ROLES.DRIVER }), query)
    .filter()
    .sort()
    .search(["firstName", "lastName", "middleName", "email", "phone"])
    .paginate();
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

export const UserService = {
  createUserToDB,
  getUserProfileFromDB,
  updateProfileToDB,
  getAllDriversFromDB,
  getAllRidersFromDB,
  getAllDriverApplicationsFromDB,
};
