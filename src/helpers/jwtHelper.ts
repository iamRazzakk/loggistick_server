import jwt from "jsonwebtoken";
import config from "../config";
import crypto from "crypto";

// Access Token create
const createAccessToken = (user: { id: string; role: string }) => {
  // @ts-ignore
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      tokenVersion: config.jwt.tokenVersion,
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
const createRefreshToken = (userId: string) => {
  // @ts-ignore
  return jwt.sign(
    {
      id: userId,
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

export const jwtHelpers = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
