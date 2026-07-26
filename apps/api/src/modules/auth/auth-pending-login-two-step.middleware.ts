import type { Request } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";
import { AuthValidationError } from "./auth.errors.js";
import { verifyPendingLoginTwoStepToken } from "./auth-pending-login-two-step.tokens.js";

function readBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function readPendingLoginTwoStepToken(req: Request): string | null {
  const config = resolveAuthConfig();
  const cookieToken = req.cookies?.[config.pendingLoginTwoStepCookieName];

  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return readBearerToken(req);
}

export function resolvePendingLoginTwoStepUserId(req: Request): string {
  const token = readPendingLoginTwoStepToken(req);

  if (!token) {
    throw new AuthValidationError("Login verification session is invalid.");
  }

  try {
    return verifyPendingLoginTwoStepToken(token).sub;
  } catch {
    throw new AuthValidationError("Login verification session is invalid.");
  }
}
