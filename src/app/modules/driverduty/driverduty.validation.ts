import { z } from "zod";

const dutyQuerySchema = z.object({
  date: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  driverId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
});

const getDutyLogsZodSchema = z.object({
  query: dutyQuerySchema,
});

export const DriverDutyValidations = {
  getDutyLogsZodSchema,
};
