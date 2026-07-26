import type { Response } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";
import { resolvePendingConfirmationCookieMaxAgeMs } from "./auth-pending-confirmation.tokens.js";

export function setPendingConfirmationCookie(res: Response, token: string): void {
  res.cookie(resolveAuthConfig().pendingConfirmationCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: resolvePendingConfirmationCookieMaxAgeMs(),
  });
}

export function clearPendingConfirmationCookie(res: Response): void {
  res.clearCookie(resolveAuthConfig().pendingConfirmationCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/v1/auth",
  });
}
