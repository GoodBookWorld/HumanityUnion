import type { NextFunction, Request, Response } from "express";

import { findAuthUserById } from "./auth-user.repository.js";
import type { AuthUserRecord } from "./auth-user.types.js";

/**
 * Pack 24B.1 — non-leaky mutation rejection when auth_users.status !== "active".
 * Does not expose moderation reason, review token, or suspension internals.
 */
export const ACCOUNT_ACCESS_SUSPENDED_MESSAGE = "Your account access is suspended.";

type AuthUserLookupFn = (userId: string) => Promise<AuthUserRecord | null>;

let authUserLookupOverrideForTests: AuthUserLookupFn | null = null;

/** Test-only override so gate behavior can be proven without Mongo. */
export function setAuthUserLookupOverrideForTests(override: AuthUserLookupFn | null): void {
  authUserLookupOverrideForTests = override;
}

export function isMutatingHttpMethod(method: string): boolean {
  const normalized = method.toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD" && normalized !== "OPTIONS";
}

/**
 * Session teardown must remain available to disabled accounts holding a residual JWT
 * so clients can clear credentials after suspension.
 */
export function isAuthSessionTeardownPath(req: Request): boolean {
  const path = req.path || "";
  return (
    path === "/logout" ||
    path.endsWith("/logout") ||
    path === "/sessions/revoke-all" ||
    path.endsWith("/sessions/revoke-all")
  );
}

export async function loadAuthUserForActiveGate(userId: string): Promise<AuthUserRecord | null> {
  if (authUserLookupOverrideForTests) {
    return authUserLookupOverrideForTests(userId);
  }

  return findAuthUserById(userId);
}

function sendAccountSuspended(res: Response): void {
  res.status(403).json({
    success: false,
    data: null,
    meta: {},
    links: {},
    message: ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
  });
}

/**
 * Shared Pack 24B.1 rule:
 * authenticated mutation → load current auth user → require status === "active".
 *
 * Safe methods always pass. Bootstrap identity is skipped (dev fallback).
 * Canonical source: auth_users.status (not participant_suspensions).
 */
export async function requireActiveAccountForMutationsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isMutatingHttpMethod(req.method)) {
    next();
    return;
  }

  if (isAuthSessionTeardownPath(req)) {
    next();
    return;
  }

  if (!req.auth?.id || req.auth.id === "auth-bootstrap-001") {
    next();
    return;
  }

  const user = await loadAuthUserForActiveGate(req.auth.id);

  if (!user || user.status !== "active") {
    sendAccountSuspended(res);
    return;
  }

  next();
}
