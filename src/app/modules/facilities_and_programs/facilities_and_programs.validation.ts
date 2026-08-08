import { z } from "zod";
const FacilitiesAndProgramsZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }),
  type: z.enum(["hospital", "clinic", "program", "nursingHome", "other"], {
    required_error: "Type is required",
  }),
  status: z.boolean({ required_error: "Status is required" }).default(true),
});

const createFacilitiesAndProgramsZodSchema = z.object({
  body: FacilitiesAndProgramsZodSchema,
});

const updateFacilitiesAndProgramsZodSchema = z.object({
  body: FacilitiesAndProgramsZodSchema.partial(),
});

export const FacilitiesAndProgramsValidations = {
  createFacilitiesAndProgramsZodSchema,
  updateFacilitiesAndProgramsZodSchema,
};
