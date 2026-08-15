import type { CookieOptions, Response } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";

/**
 * Launch Readiness Pack 07 — browser session cookies.
 *
 * Access + refresh JWTs are HttpOnly (not readable by document.cookie).
 * Host-only cookies (no Domain) so api.huws.org / localhost:4000 own them;
 * the browser sends them on credentialed calls to the API origin.
 */

export const AUTH_COOKIE_PATH = "/";

function isSecureCookieEnvironment(): boolean {
  // Read at call time so production Secure is correct after env load / tests.
  return (process.env.NODE_ENV ?? "development") === "production";
}

function baseCookieOptions(maxAgeMs?: number): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieEnvironment(),
    path: AUTH_COOKIE_PATH,
  };

  if (typeof maxAgeMs === "number" && Number.isFinite(maxAgeMs) && maxAgeMs > 0) {
    options.maxAge = Math.floor(maxAgeMs);
  }

  return options;
}

/** Parse JWT-style duration strings (`15m`, `7d`, `24h`, plain seconds). */
export function parseDurationToMs(value: string, fallbackMs: number): number {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallbackMs;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000;
  }

  const match = /^(\d+)([smhd])$/i.exec(trimmed);

  if (!match) {
    return fallbackMs;
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 3_600_000;
    case "d":
      return amount * 86_400_000;
    default:
      return fallbackMs;
  }
}

export function resolveAccessCookieMaxAgeMs(): number {
  return parseDurationToMs(resolveAuthConfig().jwtAccessExpiresIn, 15 * 60_000);
}

export function resolveRefreshCookieMaxAgeMs(): number {
  return parseDurationToMs(resolveAuthConfig().jwtRefreshExpiresIn, 30 * 86_400_000);
}

export function getAuthCookieSecuritySnapshot(): {
  accessCookieName: string;
  refreshCookieName: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: typeof AUTH_COOKIE_PATH;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
} {
  const config = resolveAuthConfig();

  return {
    accessCookieName: config.accessCookieName,
    refreshCookieName: config.refreshCookieName,
    httpOnly: true,
    secure: isSecureCookieEnvironment(),
    sameSite: "lax",
    path: AUTH_COOKIE_PATH,
    accessMaxAgeMs: resolveAccessCookieMaxAgeMs(),
    refreshMaxAgeMs: resolveRefreshCookieMaxAgeMs(),
  };
}

export function setAccessTokenCookie(res: Response, accessToken: string): void {
  const config = resolveAuthConfig();
  res.cookie(config.accessCookieName, accessToken, baseCookieOptions(resolveAccessCookieMaxAgeMs()));
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const config = resolveAuthConfig();
  res.cookie(
    config.refreshCookieName,
    refreshToken,
    baseCookieOptions(resolveRefreshCookieMaxAgeMs()),
  );
}

export function setAuthSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  setAccessTokenCookie(res, tokens.accessToken);
  setRefreshTokenCookie(res, tokens.refreshToken);
}

export function clearAccessTokenCookie(res: Response): void {
  const config = resolveAuthConfig();
  res.clearCookie(config.accessCookieName, baseCookieOptions());
}

export function clearRefreshTokenCookie(res: Response): void {
  const config = resolveAuthConfig();
  const options = baseCookieOptions();
  res.clearCookie(config.refreshCookieName, options);
  // Pre-Pack-07 refresh cookies used path `/api/v1/auth`.
  res.clearCookie(config.refreshCookieName, { ...options, path: "/api/v1/auth" });
}

export function clearAuthSessionCookies(res: Response): void {
  clearAccessTokenCookie(res);
  clearRefreshTokenCookie(res);
}
