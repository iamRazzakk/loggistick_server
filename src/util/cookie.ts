import {
  type CookieOptions,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cryptoToken from "./cryptoToken";
import { jwtHelpers } from "../helpers/jwtHelper";

export const AUTH_COOKIE_ACCESS = "access_token";
export const AUTH_COOKIE_REFRESH = "refresh_token";
const CSRF_COOKIE = "csrf_token";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const COOKIE_SAME_SITE: CookieOptions["sameSite"] =
  process.env.COOKIE_SAME_SITE === "strict" ||
  process.env.COOKIE_SAME_SITE === "none" ||
  process.env.COOKIE_SAME_SITE === "lax"
    ? process.env.COOKIE_SAME_SITE
    : "lax";

export function createCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: "/",
    maxAge,
  };
}

export function createCsrfCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: false,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(res: Response, userId: string, role: string) {
  const accessToken = jwtHelpers.createAccessToken({ id: userId, role: role });
  const refreshToken = jwtHelpers.createRefreshToken(userId);
  const csrfToken = cryptoToken();

  const accessMaxAge = 15 * 60 * 1000;
  const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;

  res.cookie(
    AUTH_COOKIE_ACCESS,
    accessToken,
    createCookieOptions(accessMaxAge),
  );
  res.cookie(
    AUTH_COOKIE_REFRESH,
    refreshToken,
    createCookieOptions(refreshMaxAge),
  );
  res.cookie(CSRF_COOKIE, csrfToken, createCsrfCookieOptions(refreshMaxAge));
}

export function clearAuthCookies(res: Response) {
  const clearOptions: CookieOptions = {
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: "/",
  };

  res.clearCookie(AUTH_COOKIE_ACCESS, clearOptions);
  res.clearCookie(AUTH_COOKIE_REFRESH, clearOptions);
  res.clearCookie(CSRF_COOKIE, clearOptions);
}

/** Enforce double-submit CSRF only when httpOnly auth cookies are sent (Bearer-only clients skip). */
export function requireCsrfWhenUsingAuthCookies(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const hasAuthCookie =
    Boolean(req.cookies?.[AUTH_COOKIE_ACCESS]) ||
    Boolean(req.cookies?.[AUTH_COOKIE_REFRESH]);
  if (!hasAuthCookie) {
    return next();
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE];
  const csrfHeader = req.header("x-csrf-token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      message: "Invalid csrf Token",
    });
  }

  next();
}
