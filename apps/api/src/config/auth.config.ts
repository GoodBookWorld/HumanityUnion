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
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    refreshCookieName: "hu_refresh_token",
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
