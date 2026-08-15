import { environment } from "./environment.js";
import { isBootstrapAllowed } from "./platform.config.js";

export function isAuthBootstrapFallbackEnabled(): boolean {
  return isBootstrapAllowed();
}

function resolveJwtAccessExpiresIn(): string {
  const ttlMinutes = process.env.JWT_ACCESS_TOKEN_TTL_MINUTES?.trim();

  if (ttlMinutes && /^\d+$/.test(ttlMinutes)) {
    return `${ttlMinutes}m`;
  }

  return process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
}

export function resolveAuthConfig() {
  const isProduction = environment.nodeEnv === "production";

  return {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ??
      (isProduction ? "" : "dev-jwt-access-secret-change-before-production"),
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET ??
      (isProduction ? "" : "dev-jwt-refresh-secret-change-before-production"),
    jwtAccessExpiresIn: resolveJwtAccessExpiresIn(),
    /**
     * PWA Experience Pack 01 — remembered session for installed app launches.
     * Short-lived access JWT (~15m) + rotating refresh (~30d). Not immortal;
     * logout / password-reset / security events still revoke refresh family.
     */
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
    /** HttpOnly access JWT for browser sessions (Pack 07). */
    accessCookieName: process.env.AUTH_ACCESS_COOKIE_NAME?.trim() || "hu_access_token",
    /**
     * Refresh cookie — same name historically used for localStorage; now
     * HttpOnly-only for browsers (Pack 07). Path is `/` (see auth-session.cookies).
     */
    refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME?.trim() || "hu_refresh_token",
    pendingConfirmationCookieName: "hu_pending_confirmation",
    pendingLoginTwoStepCookieName: "hu_pending_login_two_step",
    bootstrapFallbackEnabled: isAuthBootstrapFallbackEnabled(),
  };
}

export function assertAuthSecretsConfigured(): void {
  const config = resolveAuthConfig();

  if (!config.jwtAccessSecret || !config.jwtRefreshSecret) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured.");
  }
}

export function resolveAuthRateLimitConfig() {
  return {
    windowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    maxAttempts: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS ?? "20", 10),
  };
}

/**
 * Refresh must tolerate multi-tab / PWA restore bursts without matching login abuse limits.
 * Defaults: 120 attempts / 15 minutes per client IP (access JWT ~15m; single-flight client).
 */
export function resolveAuthRefreshRateLimitConfig() {
  return {
    windowMs: Number.parseInt(
      process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS ??
        process.env.AUTH_RATE_LIMIT_WINDOW_MS ??
        "900000",
      10,
    ),
    maxAttempts: Number.parseInt(process.env.AUTH_REFRESH_RATE_LIMIT_MAX_ATTEMPTS ?? "120", 10),
  };
}
