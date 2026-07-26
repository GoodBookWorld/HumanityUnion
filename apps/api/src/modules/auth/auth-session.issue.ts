import { randomUUID } from "node:crypto";

import type { AuthTokenPair, AuthUserPublic } from "@hu/types";

import { createAuthSession } from "./auth-session.repository.js";
import { toAuthUserPublic } from "./auth-user.projection.js";
import type { AuthUserRecord } from "./auth-user.types.js";
import {
  createAccessToken,
  createRefreshToken,
  resolveAccessExpiresInLabel,
  resolveRefreshExpiryIso,
} from "./auth-tokens.js";

export interface AuthSessionResult {
  kind: "session";
  user: AuthUserPublic;
  tokens: AuthTokenPair;
}

/** @deprecated Use AuthSessionResult */
export type AuthLoginResult = AuthSessionResult;

function buildTokenPair(user: AuthUserRecord, sessionId: string): AuthTokenPair {
  const accessToken = createAccessToken({
    sub: user.userId,
    memberId: user.memberId,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
  });

  const refreshToken = createRefreshToken({
    sub: user.userId,
    sessionId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: resolveAccessExpiresInLabel(),
  };
}

export async function issueAuthSession(
  user: AuthUserRecord,
  userAgent?: string,
): Promise<AuthLoginResult> {
  const sessionId = randomUUID();
  const tokens = buildTokenPair(user, sessionId);

  await createAuthSession({
    sessionId,
    userId: user.userId,
    refreshToken: tokens.refreshToken,
    expiresAt: resolveRefreshExpiryIso(),
    userAgent,
  });

  return {
    kind: "session",
    user: toAuthUserPublic(user),
    tokens,
  };
}
