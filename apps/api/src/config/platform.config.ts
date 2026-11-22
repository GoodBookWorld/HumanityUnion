import type { PlatformMode } from "@hu/types";

import { environment } from "./environment.js";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === "true" || value === "1";
}

export function resolvePlatformMode(): PlatformMode {
  const mode = process.env.PLATFORM_MODE?.trim();

  // Staging uses production-like NODE_ENV + noindex Web mode.
  // API treats PLATFORM_MODE=staging as beta (invite-gated, no bootstrap).
  if (mode === "staging") {
    return "beta";
  }

  if (mode === "beta" || mode === "production" || mode === "development") {
    return mode;
  }

  if (process.env.NODE_ENV === "production") {
    return "beta";
  }

  return "development";
}

export function isPlatformModeDevelopment(): boolean {
  return resolvePlatformMode() === "development";
}

export function isPlatformModeBeta(): boolean {
  return resolvePlatformMode() === "beta";
}

export function isPlatformModeProduction(): boolean {
  return resolvePlatformMode() === "production";
}

export function isRegistrationInviteRequired(): boolean {
  if (isPlatformModeBeta()) {
    return true;
  }

  if (isPlatformModeProduction()) {
    return !parseBoolean(process.env.ALLOW_PUBLIC_REGISTRATION, false);
  }

  return false;
}

export function isBootstrapAllowed(): boolean {
  if (isPlatformModeBeta() || isPlatformModeProduction()) {
    return false;
  }

  return parseBoolean(process.env.AUTH_BOOTSTRAP_FALLBACK, environment.nodeEnv !== "production");
}

export function shouldShowBetaBanner(): boolean {
  return isPlatformModeBeta();
}

export function resolveBetaInviteExpiresDays(): number {
  return Number.parseInt(process.env.BETA_INVITE_EXPIRES_DAYS ?? "14", 10);
}

/**
 * Participant account deletion stays off until the Privacy Policy amendment
 * is published and this server flag is set. A client cannot turn it on.
 * Unset and any value other than true/1 stay disabled, including production.
 */
export function isAccountDeletionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ACCOUNT_DELETION_ENABLED?.trim();
  return value === "true" || value === "1";
}
