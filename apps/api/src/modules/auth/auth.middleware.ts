import type { AuthIdentity } from "@hu/types";
import type { NextFunction, Request, Response } from "express";

import { isAuthBootstrapFallbackEnabled } from "../../config/auth.config.js";
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

function resolveJwtIdentity(req: Request): AuthIdentity | null {
  const token = extractBearerToken(req);

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

export function authenticationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const jwtIdentity = resolveJwtIdentity(req);

  if (jwtIdentity) {
    req.auth = jwtIdentity;
    next();
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

/** Requires a valid JWT bearer token. Bootstrap fallback is never accepted. */
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
  next();
}

export function isBootstrapAuthIdentity(auth?: AuthIdentity): boolean {
  return auth?.id === bootstrapAuthIdentity.id;
}

/** Resolves JWT when present without applying bootstrap fallback. */
export function optionalAuthenticationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const jwtIdentity = resolveJwtIdentity(req);

  if (jwtIdentity) {
    req.auth = jwtIdentity;
  }

  next();
}
