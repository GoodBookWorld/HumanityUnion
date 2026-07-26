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
