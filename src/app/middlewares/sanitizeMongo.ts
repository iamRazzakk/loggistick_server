import { NextFunction, Request, Response } from "express";

/**
 * Blocks MongoDB operator injection for the whole API.
 *
 * Removes every key that starts with "$" (e.g. {"$ne": ...}, {"$set": ...},
 * {"$where": ...}) and prototype-pollution keys from req.body, req.query and
 * req.params, at any depth. Real payloads never need such keys, so anything
 * the client sends is treated as plain data:
 *   - ?email[$ne]=x          → email = {}          (matches nothing)
 *   - {"$set":{"price":0}}   → {}                  (update can't bypass field locks)
 */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 20;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !Buffer.isBuffer(value) &&
  !(value instanceof Date);

export const stripMongoOperators = <T>(value: T, depth = 0): T => {
  if (depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripMongoOperators(item, depth + 1)) as T;
  }
  if (!isPlainObject(value)) return value;

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || BLOCKED_KEYS.has(key)) {
      delete obj[key];
    } else {
      obj[key] = stripMongoOperators(obj[key], depth + 1);
    }
  }
  return value;
};

const sanitizeMongo = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) req.body = stripMongoOperators(req.body);
  if (req.query) stripMongoOperators(req.query);
  if (req.params) stripMongoOperators(req.params);
  next();
};

export default sanitizeMongo;
