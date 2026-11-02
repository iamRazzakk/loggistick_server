import { z } from "zod";
const reportZodSchema = z.object({
  userId: z
    .string({
      required_error: "User ID is required",
    })
    .optional(),
  reportedBy: z
    .string({
      required_error: "Reported By is required",
    })
    .optional(),
  tripId: z
    .string({
      required_error: "Trip ID is required",
    })
    .optional(),
  reason: z
    .string({
      required_error: "Reason is required",
    })
    .optional(),
  documents: z
    .string({
      required_error: "Documents is required",
    })
    .optional(),
  reportStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  assignedUserId: z.string().optional(),
  internalNote: z.string().optional(),
});

const createReportZodSchema = z.object({
  body: reportZodSchema,
});
const updateReportZodSchema = z.object({
  body: reportZodSchema.partial(),
});

export const ReportsValidations = {
  createReportZodSchema,
  updateReportZodSchema,
};
