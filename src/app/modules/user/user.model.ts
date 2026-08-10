import { model, Schema } from "mongoose";
import { USER_ROLES } from "../../../enums/user";
import { IDriverData, IUser, UserModal } from "./user.interface";
import bcrypt from "bcrypt";
import ApiError from "../../../errors/ApiErrors";
import { StatusCodes } from "http-status-codes";
import config from "../../../config";

const driverDataSchema = new Schema<IDriverData>(
  {
    driverExperience: {
      type: String,
      enum: ["1-3 years", "4-6 years", "7-10 years", "11-15 years"],
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
    },
    licenseClass: {
      type: String,
      enum: ["A", "B", "C"],
      required: true,
    },
    expirationDate: {
      type: Date,
      required: true,
    },
    licenseImage: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const userSchema = new Schema<IUser, UserModal>(
  {
    firstName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    driverData: {
      type: driverDataSchema,
      required: false,
    },
    accessScope: {
      type: [String],
      required: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
      required: [true, "Email is required!"],
      trim: true,
      unique: true,
      lowercase: true,
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        "Please provide a valid email!",
      ],
      index: true,
    },
    contact: {
      type: String,
      required: [true, "Contact is required!"],
      match: [/^\+?[1-9]\d{1,14}$/, "Please provide a valid contact number!"],
    },
    password: {
      type: String,
      required: [true, "Password is required!"],
      select: 0,
      minlength: 8,
    },
    applicationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    trip: {
      type: Number,
      default: 0,
    },
    publicId: {
      type: String,
      required: false,
      unique: true,
    },
    location: {
      type: String,
      required: false,
    },
    profile: {
      type: String,
      default: "/image.png",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    deviceToken: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
// for fast lookup
// userSchema.index({ email: 1 });
// if filtering by role often
userSchema.index({ role: 1 });
//exist user check
userSchema.statics.isExistUserById = async (id: string) => {
  const isExist = await User.findById(id);
  return isExist;
};

userSchema.statics.isExistUserByEmail = async (email: string) => {
  const isExist = await User.findOne({ email });
  return isExist;
};

//account check
userSchema.statics.isAccountCreated = async (id: string) => {
  const isUserExist: any = await User.findById(id);
  return isUserExist.accountInformation.status;
};

//is match password
userSchema.statics.isMatchPassword = async (
  password: string,
  hashPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashPassword);
};

//check user
userSchema.pre("save", async function (next) {
  //check user
  const isExist = await User.findOne({ email: this.email });
  if (isExist) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Email already exist!");
  }

  //password hash
  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_rounds),
  );
  next();
});
export const User = model<IUser, UserModal>("User", userSchema);
