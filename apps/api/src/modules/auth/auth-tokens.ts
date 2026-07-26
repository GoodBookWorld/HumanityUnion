import { randomUUID } from "node:crypto";

import type { AuthUserAccountRole } from "@hu/types";
import jwt, { type SignOptions } from "jsonwebtoken";

import { assertAuthSecretsConfigured, resolveAuthConfig } from "../../config/auth.config.js";

export interface AccessTokenPayload {
  sub: string;
  memberId: string;
  role: AuthUserAccountRole;
  displayName: string;
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: "refresh";
}

export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

export function createAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  assertAuthSecretsConfigured();
  const config = resolveAuthConfig();
  const signOptions: SignOptions = {
    expiresIn: config.jwtAccessExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ ...payload, type: "access" }, config.jwtAccessSecret, signOptions);
}

export function createRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  assertAuthSecretsConfigured();
  const config = resolveAuthConfig();
  const signOptions: SignOptions = {
    expiresIn: config.jwtRefreshExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    { ...payload, type: "refresh", jti: randomUUID() },
    config.jwtRefreshSecret,
    signOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  assertAuthSecretsConfigured();
  const config = resolveAuthConfig();
  const payload = jwt.verify(token, config.jwtAccessSecret) as AccessTokenPayload;

  if (payload.type !== "access") {
    throw new Error("Invalid access token type.");
  }

  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  assertAuthSecretsConfigured();
  const config = resolveAuthConfig();
  const payload = jwt.verify(token, config.jwtRefreshSecret) as RefreshTokenPayload;

  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token type.");
  }

  return payload;
}

export function resolveRefreshExpiryIso(): string {
  const config = resolveAuthConfig();
  const expiresAt = new Date(
    Date.now() + parseDurationToSeconds(config.jwtRefreshExpiresIn) * 1000,
  );

  return expiresAt.toISOString();
}

export function resolveAccessExpiresInLabel(): string {
  return resolveAuthConfig().jwtAccessExpiresIn;
}
