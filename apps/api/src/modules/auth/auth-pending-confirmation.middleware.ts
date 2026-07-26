import type { Request } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";
import { AuthValidationError } from "./auth.errors.js";
import { verifyPendingConfirmationToken } from "./auth-pending-confirmation.tokens.js";

function readBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function readPendingConfirmationToken(req: Request): string | null {
  const config = resolveAuthConfig();
  const cookieToken = req.cookies?.[config.pendingConfirmationCookieName];

  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return readBearerToken(req);
}

export function resolvePendingConfirmationUserId(req: Request): string {
  const token = readPendingConfirmationToken(req);

  if (!token) {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }

  try {
    return verifyPendingConfirmationToken(token).sub;
  } catch {
    throw new AuthValidationError("Email confirmation session is invalid.");
  }
}
