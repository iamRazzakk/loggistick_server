import { StatusCodes } from "http-status-codes";
import ApiError from "../errors/ApiErrors";

const parseValue = (value: unknown) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return value;
  if (
    !(
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed === "true" ||
      trimmed === "false" ||
      trimmed === "null" ||
      /^-?\d+(\.\d+)?$/.test(trimmed)
    )
  ) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return value;
  }
};

export const parseBody = <T = Record<string, unknown>>(
  data: Record<string, unknown>,
): T => {
  if (!data || typeof data !== "object") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid request body");
  }
  if (typeof data.data === "string") {
    try {
      const parsed = JSON.parse(data.data);
      const { data: _, ...rest } = data;
      return { ...parsed, ...rest } as T;
    } catch {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to parse body data");
    }
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = parseValue(value);
  }
  return result as T;
};
