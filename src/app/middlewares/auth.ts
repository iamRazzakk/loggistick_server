import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { jwtHelpers } from "../../helpers/jwtHelper";
import ApiError from "../../errors/ApiErrors";
import { User } from "../modules/user/user.model";
import crypto from "crypto";
import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_CSRF } from "../../util/cookie";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function resolveAccessToken(
  req: Request,
): { token?: string; fromCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const t = authHeader.split(" ")[1];
    return { token: t || undefined, fromCookie: false };
  }
  const fromCookie = req.cookies?.[AUTH_COOKIE_ACCESS] as string | undefined;
  return { token: fromCookie, fromCookie: true };
}

// Cookie auth is sent by the browser automatically, so state-changing
// requests must also echo the csrf_token cookie in the X-CSRF-Token header
// (double-submit). Bearer-token requests don't need this.
function assertCsrf(req: Request) {
  if (SAFE_METHODS.includes(req.method)) return;
  const cookieToken = req.cookies?.[AUTH_COOKIE_CSRF];
  const headerToken = req.headers["x-csrf-token"];
  if (
    !cookieToken ||
    typeof headerToken !== "string" ||
    headerToken.length !== cookieToken.length ||
    !crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))
  ) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Invalid CSRF token");
  }
}

const auth =
  (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { token, fromCookie } = resolveAccessToken(req);

      if (!token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
      }
      if (fromCookie) assertCsrf(req);

      let verifyUser = null;
      try {
        verifyUser = jwtHelpers.verifyAccessToken(token);
      } catch {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Invalid or expired token",
        );
      }

      if (!verifyUser) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
      }

      const dbUser = await User.findById(verifyUser.id)
        .select("role isBanned tokenVersion email")
        .lean();

      if (!dbUser) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "User not found");
      }
      if (dbUser.isBanned) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Account is suspended");
      }

      if (!jwtHelpers.isTokenVersionValid(verifyUser, dbUser.tokenVersion)) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Session expired. Please login again",
        );
      }

      if (dbUser.role !== verifyUser.role) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Permission changed. Please login again",
        );
      }

      req.user = {
        id: dbUser._id.toString(),
        email: verifyUser.email ?? dbUser.email,
        role: dbUser.role,
      };

      if (roles.length && !roles.includes(verifyUser.role)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to access this api",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
export default auth;
