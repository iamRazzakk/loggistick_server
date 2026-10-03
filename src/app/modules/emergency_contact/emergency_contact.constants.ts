export const EMERGENCY_RELATIONSHIPS = [
  "father",
  "mother",
  "daughter",
  "son",
  "wife",
  "other",
] as const;

export const EMERGENCY_CONTACT_CACHE_TTL = 24 * 60 * 60;

export const emergencyContactCacheKey = (userId: string) =>
  `emergencyContact:${userId}`;
