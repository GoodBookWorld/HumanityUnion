import type { AuthTokenPair } from "@hu/types";

import { resolveAuthConfig } from "../../src/config/auth.config.js";

/**
 * Launch Readiness Pack 07 — build a Cookie header for isolated API tests
 * that exercise HttpOnly browser-session semantics without a real browser.
 */
export function buildAuthCookieHeader(tokens: AuthTokenPair): string {
  const config = resolveAuthConfig();
  return [
    `${config.accessCookieName}=${tokens.accessToken}`,
    `${config.refreshCookieName}=${tokens.refreshToken}`,
  ].join("; ");
}

export function buildAccessCookieHeader(accessToken: string): string {
  const config = resolveAuthConfig();
  return `${config.accessCookieName}=${accessToken}`;
}
