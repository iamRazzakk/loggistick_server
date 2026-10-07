import { type CookieOptions, type Response } from "express";
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

function createCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: "/",
    maxAge,
  };
}

function createCsrfCookieOptions(maxAge: number): CookieOptions {
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

