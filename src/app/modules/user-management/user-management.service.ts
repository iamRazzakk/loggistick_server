import { StatusCodes } from "http-status-codes";
import ApiError from "../../../errors/ApiErrors";
import { IUser } from "../user/user.interface";
import { User } from "../user/user.model";
import { USER_ROLES } from "../../../enums/user";
import crypto from "crypto";
import { generateDateOfBirth } from "../../../util/generateDateOfBirth";
import { emailTemplate } from "../../../shared/emailTemplate";
import { emailHelper } from "../../../helpers/emailHelper";

const generateLoggPassword = () => {
  const randomValue = crypto.randomInt(100000, 1000000);
  return `logg${randomValue}`;
};

const createUserManagement = async (payload: IUser) => {
  const user = await User.findOne({ email: payload.email });
  if (user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User already exists");
  }

  const generatedPassword = generateLoggPassword();
  payload.role = USER_ROLES.USER;
  payload.dateOfBirth = generateDateOfBirth();
  payload.password = generatedPassword;
  payload.verified = true;

  const result = await User.create(payload);

  const name =
    `${result.firstName} ${result.middleName ? result.middleName + " " : ""}${result.lastName}`.trim();
  const credentialsEmail = emailTemplate.userCredentials({
    name,
    email: result.email,
    password: generatedPassword,
  });
  await emailHelper.sendEmail(credentialsEmail);

  return result;
};

export const UserManagementServices = {
  createUserManagement,
};
