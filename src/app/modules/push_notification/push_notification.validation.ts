import { z } from "zod";
import { USER_ROLES } from "../../../enums/user";

const pushNotificationBodySchema = z.object({
  title: z.string({ required_error: "Title is required" }),
  message: z.string({ required_error: "Message is required" }),
  role: z.enum(Object.values(USER_ROLES) as [string, ...string[]], {
    required_error: "Role is required",
  }),
});

const createPushNotificationZodSchema = z.object({
  body: pushNotificationBodySchema,
});

export const PushNotificationValidations = { createPushNotificationZodSchema };
