import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { jwtHelpers } from "../../helpers/jwtHelper";
import ApiError from "../../errors/ApiErrors";
import { User } from "../modules/user/user.model";
import { AUTH_COOKIE_ACCESS } from "../../util/cookie";

function resolveAccessToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const t = authHeader.split(" ")[1];
    return t || undefined;
  }
  const fromCookie = req.cookies?.[AUTH_COOKIE_ACCESS] as string | undefined;
  return fromCookie;
}

const auth =
  (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = resolveAccessToken(req);

      if (!token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
      }

      let verifyUser = null;
      try {
        verifyUser = jwtHelpers.verifyAccessToken(token);
      } catch {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Invalid or expired token"
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

      if (dbUser.role !== verifyUser.role) {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Permission changed. Please login again"
        );
      }

      req.user = {
        id: dbUser._id.toString(),
        email: verifyUser.email ?? dbUser.email,
        role: dbUser.role,
        tokenVersion: dbUser.tokenVersion,
      };

      if (roles.length && !roles.includes(verifyUser.role)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to access this api"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
export default auth;
