import { z } from "zod";
import { BROADCAST_AUDIENCES } from "./broadcast.interface";

const audienceSchema = z.enum(BROADCAST_AUDIENCES);

const sendBroadcastZodSchema = z.object({
  body: z
    .object({
      title: z
        .string({ required_error: "Title is required" })
        .trim()
        .min(1, "Title is required")
        .max(150),
      description: z
        .string({ required_error: "Description is required" })
        .trim()
        .min(1, "Description is required")
        .max(1000),
      audience: z.union([
        audienceSchema,
        z.array(audienceSchema).min(1, "Audience is required"),
      ]),
    }),
});

export const BroadcastValidation = { sendBroadcastZodSchema };
