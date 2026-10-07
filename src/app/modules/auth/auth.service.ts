import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { emailHelper } from "../../../helpers/emailHelper";
import { emailTemplate } from "../../../shared/emailTemplate";
import {
  IAuthResetPassword,
  IChangePassword,
  ILoginData,
  IVerifyEmail,
} from "../../../types/auth";
import cryptoToken from "../../../util/cryptoToken";
import generateOTP from "../../../util/generateOTP";
import { ResetToken } from "../resetToken/resetToken.model";
import { User } from "../user/user.model";
import { jwtHelpers } from "../../../helpers/jwtHelper";
import { redisService } from "../../../redis/redis.service";
import { USER_ROLES } from "../../../enums/user";
import { setDispatcherRoutes } from "../../../helpers/dispatcherRouteCache";

//login
const loginUserFromDB = async (payload: ILoginData) => {
  const { email, password, fcmToken } = payload;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }
  // Verified check
  if (!user.verified) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Please verify your account first!",
    );
  }
  if (user.role != USER_ROLES.SUPER_ADMIN && !fcmToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Device token is required!");
  }
  if (user.role === USER_ROLES.DRIVER) {
    if (!user.isAdminVerifiedDriver) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Please wait for admin verification!",
      );
    }
  }

  // Password match check
  const isPasswordMatched = await User.isMatchPassword(password, user.password);
  if (!isPasswordMatched) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is incorrect!");
  }

  if (fcmToken && user.fcmToken !== fcmToken) {
    await User.updateMany(
      { _id: { $ne: user._id }, fcmToken },
      { $set: { fcmToken: null } },
    );
    await User.findByIdAndUpdate(user._id, { fcmToken });
  }

  if (user.role === USER_ROLES.DISPATCHER) {
    setDispatcherRoutes(user._id.toString(), user.accessScope ?? []);
  }

  // Access Token
  const accessToken = jwtHelpers.createAccessToken({
    id: user._id.toString(),
    role: user.role,
  });

  const refreshToken = jwtHelpers.createRefreshToken(user._id.toString());

  return {
    role: user.role,
    accessToken,
    refreshToken,
    ...(user.role === USER_ROLES.DISPATCHER
      ? { accessScope: user.accessScope ?? [] }
      : {}),
  };
};

//forget password
const forgetPasswordToDB = async (email: string) => {
  const isExistUser = await User.isExistUserByEmail(email);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //send mail
  const otp = generateOTP();
  const value = {
    otp,
    email: isExistUser.email,
  };

  const forgetPassword = emailTemplate.resetPassword(value);
  emailHelper.sendEmail(forgetPassword);

  //save to redis
  await redisService.post({
    key: `otp:${isExistUser.email.toString()}`,
    value: Number(otp),
    expiration: 3 * 60000,
  });
};

//verify email
const verifyEmailToDB = async (payload: IVerifyEmail) => {
  const { email, oneTimeCode } = payload;
  const isExistUser = await User.findOne({ email }).lean();
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }
  const authentication = await redisService.get(
    `otp:${isExistUser?.email?.toString()}`,
  );
  if (!authentication) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid otp!");
  }
  if (Number(authentication) !== Number(oneTimeCode)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid otp!");
  }

  let message;
  let data;

  if (!isExistUser.verified) {
    await User.findOneAndUpdate({ email }, { verified: true });
    await redisService.del(`otp:${isExistUser.email.toString()}`);
    message = "Email verify successfully";
    data = {
      accessToken: jwtHelpers.createAccessToken({
        id: isExistUser._id.toString(),
        role: isExistUser.role,
      }),
    };
  } else {
    await User.findOneAndUpdate(
      { _id: isExistUser._id },
      {
        isResetPassword: true,
      },
    );

    //create token ;
    const createToken = cryptoToken();
    await ResetToken.create({
      user: isExistUser._id,
      token: createToken,
      expireAt: new Date(Date.now() + 5 * 60000),
    });
    await redisService.del(`otp:${isExistUser.email.toString()}`);
    message =
      "Verification Successful: Please securely store and utilize this code for reset password";
    data = createToken;
  }
  return { data, message };
};

//forget password
const resetPasswordToDB = async (
  token: string,
  payload: IAuthResetPassword,
) => {
  const { newPassword, confirmPassword } = payload;

  //isExist token
  const isExistToken = await ResetToken.isExistToken(token);
  if (!isExistToken) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
  }

  //user permission check
  const isExistUser = await User.findById(isExistToken.user).lean();

  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //validity check
  const isValid = await ResetToken.isExpireToken(token);
  if (!isValid) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Token expired, Please click again to the forget password",
    );
  }

  //check password
  if (newPassword !== confirmPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "New password and Confirm password doesn't match!",
    );
  }

  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const updateData = {
    password: hashPassword,
    authentication: {
      isResetPassword: false,
    },
  };

  await User.findOneAndUpdate({ _id: isExistToken.user }, updateData, {
    new: true,
  });
};

const changePasswordToDB = async (
  user: JwtPayload,
  payload: IChangePassword,
) => {
  const { currentPassword, newPassword, confirmPassword } = payload;
  const isExistUser = await User.findById(user.id).select("+password");
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //current password match
  if (
    currentPassword &&
    !(await User.isMatchPassword(currentPassword, isExistUser.password))
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is incorrect");
  }

  //newPassword and current password
  if (currentPassword === newPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Please give different password from current password",
    );
  }

  //new password and confirm password check
  if (newPassword !== confirmPassword) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Password and Confirm password doesn't matched",
    );
  }

  //hash password
  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const updateData = {
    password: hashPassword,
  };

  await User.findOneAndUpdate({ _id: user.id }, updateData, { new: true });
};

const newAccessTokenToUser = async (refreshToken: string) => {
  //  Refresh token
  if (!refreshToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Refresh token is required!");
  }

  let decoded;
  try {
    //  Refresh token verify
    decoded = jwtHelpers.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      "Invalid or expired refresh token!",
    );
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found!");
  }

  // New Access Token create
  const newAccessToken = jwtHelpers.createAccessToken({
    id: user._id.toString(),
    role: user.role,
  });

  const newRefreshToken = jwtHelpers.createRefreshToken(user._id.toString());

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const resendVerificationEmailToDB = async (email: string) => {
  // Find the user by ID
  const existingUser: any = await User.findOne({ email: email }).lean();

  if (!existingUser) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "User with this email does not exist!",
    );
  }

  // Generate OTP and prepare email
  const otp = generateOTP();
  const emailValues = {
    name: existingUser.firstName,
    otp,
    email: existingUser.email,
  };

  const accountEmailTemplate = emailTemplate.createAccount(emailValues);
  emailHelper.sendEmail(accountEmailTemplate);

  // save to redis
  await redisService.post({
    key: `otp:${existingUser.email.toString()}`,
    value: Number(otp),
    expiration: 3 * 60000,
  });
};

// delete user
const deleteUserFromDB = async (user: JwtPayload, password: string) => {
  const isExistUser = await User.findById(user.id).select("+password");
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  //check match password
  if (
    password &&
    !(await User.isMatchPassword(password, isExistUser.password))
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Password is incorrect");
  }

  const updateUser = await User.findByIdAndDelete(user.id);
  if (!updateUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }
  return;
};

export const AuthService = {
  verifyEmailToDB,
  loginUserFromDB,
  forgetPasswordToDB,
  resetPasswordToDB,
  changePasswordToDB,
  newAccessTokenToUser,
  resendVerificationEmailToDB,
  // socialLoginFromDB,
  deleteUserFromDB,
};
