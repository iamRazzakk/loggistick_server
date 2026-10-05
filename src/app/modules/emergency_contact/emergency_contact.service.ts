import { JwtPayload } from "jsonwebtoken";
import { redisService } from "../../../redis/redis.service";
import {
  EMERGENCY_CONTACT_CACHE_TTL,
  emergencyContactCacheKey,
} from "./emergency_contact.constants";
import { IEmergencyContact } from "./emergency_contact.interface";
import { EmergencyContact } from "./emergency_contact.model";

const cacheContact = async (userId: string, contact: IEmergencyContact) => {
  await redisService.post({
    key: emergencyContactCacheKey(userId),
    value: JSON.stringify(contact),
    expiration: EMERGENCY_CONTACT_CACHE_TTL,
  });
};

const createEmergencyContactIntoDB = async (
  user: JwtPayload,
  payload: IEmergencyContact,
) => {
  payload.userId = user.id;

  const existing = await EmergencyContact.findOne({ userId: user.id! }).lean();
  if (existing) {
    const updated = await EmergencyContact.findByIdAndUpdate(
      existing._id,
      payload,
      { new: true },
    )
      .select("-__v")
      .lean();

    await redisService.del(emergencyContactCacheKey(user.id!));
    if (updated) {
      await cacheContact(user.id!, updated);
    }
    return { contact: updated, created: false };
  }

  const created = await EmergencyContact.create(payload);
  const contact = created.toObject();
  await cacheContact(user.id!, contact);
  return { contact, created: true };
};

const getEmergencyContactFromDB = async (user: JwtPayload) => {
  const cached = await redisService.get(emergencyContactCacheKey(user.id!));
  if (cached) {
    console.log("=========>From cached data");
    return JSON.parse(cached);
  }

  const contact = await EmergencyContact.findOne({ userId: user.id! })
    .select("-__v")
    .lean();
  if (contact) {
    await cacheContact(user.id!, contact);
    console.log("=========>From DB");
  }
  return contact;
};

export const EmergencyContactServices = {
  createEmergencyContactIntoDB,
  getEmergencyContactFromDB,
};
