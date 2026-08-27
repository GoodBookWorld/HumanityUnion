import type { AuthIdentity } from "@hu/types";
import type { NextFunction, Request, Response } from "express";

import { isAuthBootstrapFallbackEnabled, resolveAuthConfig } from "../../config/auth.config.js";
import { requireActiveAccountForMutationsMiddleware } from "./auth-active-account-gate.js";
import { bootstrapAuthIdentity } from "./auth.identity.js";
import { authIdentityFromAccessTokenClaims } from "./auth.service.js";
import { verifyAccessToken } from "./auth-tokens.js";
import { bootstrapSessionContext } from "./session.context.js";

/* eslint-disable @typescript-eslint/no-namespace -- Express Request augmentation requires a global namespace. */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Launch Readiness Pack 07 — prefer Authorization Bearer (tests / non-browser
 * clients), then HttpOnly access cookie (browser sessions).
 */
export function extractAccessToken(req: Request): string | null {
  const bearer = extractBearerToken(req);

  if (bearer) {
    return bearer;
  }

  const cookieName = resolveAuthConfig().accessCookieName;
  const cookieToken = req.cookies?.[cookieName];

  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

function resolveJwtIdentity(req: Request): AuthIdentity | null {
  const token = extractAccessToken(req);

  if (!token) {
    return null;
  }

  try {
    const claims = verifyAccessToken(token);

    return authIdentityFromAccessTokenClaims({
      sub: claims.sub,
      memberId: claims.memberId,
      role: claims.role,
      displayName: claims.displayName,
      email: claims.email,
    });
  } catch {
    return null;
  }
}

/**
 * Resolves JWT identity when present (else optional bootstrap).
 * Pack 24B.1 — mutating requests with a JWT re-check auth_users.status === "active"
 * (logout / revoke-all remain allowed so residual sessions can be cleared).
 */
export function authenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const jwtIdentity = resolveJwtIdentity(req);

  if (jwtIdentity) {
    req.auth = jwtIdentity;
    void requireActiveAccountForMutationsMiddleware(req, res, next).catch(next);
    return;
  }

  if (isAuthBootstrapFallbackEnabled()) {
    req.auth = bootstrapSessionContext.getCurrentIdentity();
  }

  next();
}

/** Rejects requests without a resolved authenticated identity. */
export function requireAuthenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.auth?.id) {
    res.status(401).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Authentication required.",
    });
    return;
  }

  next();
}

/**
 * Requires a valid JWT access credential (Bearer or HttpOnly cookie).
 * Bootstrap fallback is never accepted.
 *
 * Pack 24B.1 — after JWT verification, mutating requests re-load auth_users and
 * require status === "active" so a residual access token cannot write after suspend.
 * Token claims remain authentication evidence only; DB status is authoritative for writes.
 */
export function requireJwtAuthenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const jwtIdentity = resolveJwtIdentity(req);

  if (!jwtIdentity) {
    res.status(401).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Authentication required.",
    });
    return;
  }

  req.auth = jwtIdentity;
  void requireActiveAccountForMutationsMiddleware(req, res, next).catch(next);
}

export function isBootstrapAuthIdentity(auth?: AuthIdentity): boolean {
  return auth?.id === bootstrapAuthIdentity.id;
}

/**
 * Resolves JWT when present without applying bootstrap fallback.
 * Pack 24B.1 — when a JWT is present on a mutating request, enforce active status
 * so optional-auth write handlers cannot treat a disabled residual token as active.
 */
export function optionalAuthenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const jwtIdentity = resolveJwtIdentity(req);

  if (jwtIdentity) {
    req.auth = jwtIdentity;
    void requireActiveAccountForMutationsMiddleware(req, res, next).catch(next);
    return;
  }

  next();
}
