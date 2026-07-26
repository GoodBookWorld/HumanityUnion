import type { Response } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";
import { resolvePendingLoginTwoStepCookieMaxAgeMs } from "./auth-pending-login-two-step.tokens.js";

export function setPendingLoginTwoStepCookie(res: Response, token: string): void {
  res.cookie(resolveAuthConfig().pendingLoginTwoStepCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: resolvePendingLoginTwoStepCookieMaxAgeMs(),
  });
}

export function clearPendingLoginTwoStepCookie(res: Response): void {
  res.clearCookie(resolveAuthConfig().pendingLoginTwoStepCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/v1/auth",
  });
}
