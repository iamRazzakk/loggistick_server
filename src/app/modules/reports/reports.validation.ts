import { z } from "zod";
const reportZodSchema = z.object({
  reportStatus: z.enum(["pending", "approved", "rejected"], {
    required_error: "Report Status is required",
  }),
  documents: z.string({
    required_error: "Documents is required",
  }),
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
