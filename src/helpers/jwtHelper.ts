import jwt from "jsonwebtoken";
import config from "../config";
import crypto from "crypto";

// Access Token create
// `tv` = the user's tokenVersion. Bumping User.tokenVersion (password
// change/reset) invalidates every token issued before it.
const createAccessToken = (user: {
  id: string;
  role: string;
  tokenVersion?: number;
}) => {
  // @ts-ignore
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      tv: user.tokenVersion ?? 0,
      jti: crypto.randomUUID(),
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.accessExpiresIn,
      algorithm: "HS256" as const,
    },
  );
};

// Refresh Token create
const createRefreshToken = (userId: string, tokenVersion?: number) => {
  // @ts-ignore
  return jwt.sign(
    {
      id: userId,
      tv: tokenVersion ?? 0,
      jti: crypto.randomUUID(),
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
    },
  );
};

// Verify Access Token (full strict check)
const verifyAccessToken = (token: string) => {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: ["HS256"],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    maxAge: config.jwt.accessExpiresIn,
  }) as jwt.JwtPayload;
};

// Verify Refresh Token
const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, config.jwt.refreshSecret, {
    algorithms: ["HS256"],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as jwt.JwtPayload;
};

// Tokens issued before this change have no `tv` → treated as version 0.
const isTokenVersionValid = (
  decoded: jwt.JwtPayload,
  userTokenVersion?: number | null,
) => Number(decoded?.tv ?? 0) === Number(userTokenVersion ?? 0);

export const jwtHelpers = {
  isTokenVersionValid,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
