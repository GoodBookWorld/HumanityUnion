import type {
  AdminPlatformReadinessPublic,
  AdminPlatformServiceConfigState,
} from "@hu/types";

import { environment } from "../../config/environment.js";
import { assertAuthSecretsConfigured } from "../../config/auth.config.js";
import {
  isPlatformModeDevelopment,
  resolvePlatformMode,
  isRegistrationInviteRequired,
  shouldShowBetaBanner,
} from "../../config/platform.config.js";
import {
  collectInvalidEmailConfig,
  collectInvalidMediaStorageConfig,
  resolveCorsOrigin,
} from "../../config/validate-production-environment.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveMediaStorageProviderName } from "../media-upload/media-object-storage.js";
import { resolveAiAssistantConfig } from "../workspace-assistant/assistant-engine/ai-assistant.config.js";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function isPublicSiteOriginPresent(): boolean {
  return Boolean(
    readEnv("WEB_ORIGIN") || readEnv("CORS_ORIGIN") || readEnv("NEXT_PUBLIC_SITE_URL"),
  );
}

function isApiPublicOriginPresent(): boolean {
  return Boolean(readEnv("API_PUBLIC_URL"));
}

function isEmailPublicUrlPresent(): boolean {
  return Boolean(
    readEnv("WEB_ORIGIN") || readEnv("CORS_ORIGIN") || readEnv("NEXT_PUBLIC_SITE_URL"),
  );
}

function isMediaPublicOriginPresent(): boolean {
  const provider = resolveMediaStorageProviderName();
  if (provider !== "r2") {
    return false;
  }
  return Boolean(readEnv("R2_PUBLIC_BASE_URL"));
}

function resolveEmailServiceState(): AdminPlatformServiceConfigState {
  if (isPlatformModeDevelopment()) {
    // Development may intentionally use mock mail.
    return "configured";
  }
  return collectInvalidEmailConfig().length === 0 ? "configured" : "not_configured";
}

function resolveMediaServiceState(): AdminPlatformServiceConfigState {
  const provider = resolveMediaStorageProviderName();
  if (provider === "memory") {
    return "not_configured";
  }
  if (provider === "r2") {
    return collectInvalidMediaStorageConfig().length === 0 ? "configured" : "incomplete";
  }
  // local — acceptable in development; incomplete for deployed modes
  if (isPlatformModeDevelopment()) {
    return "configured";
  }
  return "incomplete";
}

function resolveAiServiceState(): AdminPlatformServiceConfigState {
  const config = resolveAiAssistantConfig();
  return config.apiKey ? "enabled" : "disabled";
}

function resolveJwtConfigured(): boolean {
  try {
    assertAuthSecretsConfigured();
    return true;
  } catch {
    return false;
  }
}

async function assertAdminActor(userId: string): Promise<void> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

/**
 * Pack 23E.2 — safe Admin Platform readiness projection.
 * Configuration identity only — never live health, secrets, or connection strings.
 */
export async function getAdminPlatformReadiness(input: {
  actorUserId: string;
}): Promise<AdminPlatformReadinessPublic> {
  await assertAdminActor(input.actorUserId);

  const platformMode = resolvePlatformMode();
  const publicSiteOriginConfigured = isPublicSiteOriginPresent();
  const apiPublicOriginConfigured = isApiPublicOriginPresent();
  const corsOriginConfigured = Boolean(resolveCorsOrigin());
  const mediaState = resolveMediaServiceState();
  const mongoConfigured = isMongoConfigured();
  const jwtConfigured = resolveJwtConfigured();

  // Web/API chips are configuration presence, not health probes.
  const webState: AdminPlatformServiceConfigState = publicSiteOriginConfigured
    ? "configured"
    : "incomplete";
  const apiState: AdminPlatformServiceConfigState =
    apiPublicOriginConfigured && jwtConfigured ? "configured" : "incomplete";

  return {
    platformMode,
    platformVersion: environment.platformVersion,
    registrationRequiresInvite: isRegistrationInviteRequired(),
    showBetaBanner: shouldShowBetaBanner(),
    betaBannerMessage: "This platform is currently in limited testing.",
    publicSiteOriginConfigured,
    apiPublicOriginConfigured,
    corsOriginConfigured,
    cookieSecurityStatus: "external",
    emailPublicUrlConfigured: isEmailPublicUrlPresent(),
    mediaPublicOriginConfigured: isMediaPublicOriginPresent(),
    services: {
      web: webState,
      api: apiState,
      mongodb: mongoConfigured ? "configured" : "not_configured",
      email: resolveEmailServiceState(),
      media: mediaState,
      ai: resolveAiServiceState(),
    },
  };
}
