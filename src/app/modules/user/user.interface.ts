import { Model, Types } from "mongoose";
import { USER_ROLES } from "../../../enums/user";
// Stripe account related sub-document
export interface IDriverData {
  driverExperience: "1-3 years" | "4-6 years" | "7-10 years" | "11-15 years";
  licenseNumber: string;
  licenseClass: "A" | "B" | "C";
  expirationDate: Date;
  licenseImage: string;
}
// Main User interface
export type IUser = {
  publicId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: Date;
  contact: string;
  email: string;
  applicationStatus: "pending" | "approved" | "rejected";
  // driver related fields
  driverData?: IDriverData;
  role: USER_ROLES;
  county?: Types.ObjectId;
  authorizationID?: string;
  accessScope?: string[];

  password: string;
  location: string;
  profile: string;
  verified: boolean;
  isBanned: boolean;
  isOnDuty?: boolean;
  isAdminVerifiedDriver?: boolean;
  lastKnownLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  trip: number;
  deviceToken?: string;
};

export type UserModal = {
  isExistUserById(id: string): any;
  isExistUserByEmail(email: string): any;
  isAccountCreated(id: string): any;
  isMatchPassword(password: string, hashPassword: string): boolean;
} & Model<IUser>;

// need to add county
