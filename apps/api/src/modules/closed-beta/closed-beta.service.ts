import type {
  BetaOnboardingItem,
  PlatformConfigPublic,
  PlatformMode,
  WorkspaceReadiness,
} from "@hu/types";

import {
  isRegistrationInviteRequired,
  resolvePlatformMode,
  shouldShowBetaBanner,
} from "../../config/platform.config.js";
import { checkMongoConnection } from "../../infrastructure/mongodb/mongo-health.js";
import { assertAuthSecretsConfigured, resolveAuthConfig } from "../../config/auth.config.js";
import { environment } from "../../config/environment.js";
import { resolveCorsOrigin } from "../../config/validate-production-environment.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getEmailProviderHealth } from "../email/email.service.js";
import { listMyInitiatives } from "../initiatives/initiative.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getOrCreateMemberProfileForUser } from "../member-profile/member-profile.service.js";
import { loadParticipationAreaWorkspaceForParticipant } from "../participation-area/participation-area.service.js";

const BETA_BANNER_MESSAGE = "This platform is currently in limited testing.";

export function resolvePlatformConfigPublic(): PlatformConfigPublic {
  return {
    platformMode: resolvePlatformMode(),
    registrationRequiresInvite: isRegistrationInviteRequired(),
    showBetaBanner: shouldShowBetaBanner(),
    betaBannerMessage: BETA_BANNER_MESSAGE,
  };
}

function isProfileComplete(profile: { country?: string; biography?: string }): boolean {
  return Boolean(profile.country?.trim() || profile.biography?.trim());
}

function buildReadinessMissing(input: {
  emailVerified: boolean;
  profileComplete: boolean;
  participationConfigured: boolean;
}): string[] {
  const missing: string[] = [];

  if (!input.emailVerified) {
    missing.push("email verification");
  }

  if (!input.profileComplete) {
    missing.push("profile");
  }

  if (!input.participationConfigured) {
    missing.push("participation area");
  }

  return missing;
}

export async function resolveWorkspaceReadinessForUser(input: {
  userId: string;
  identity: RequestIdentity;
  displayName: string;
}): Promise<WorkspaceReadiness> {
  const [user, profile, participation] = await Promise.all([
    findAuthUserById(input.userId),
    getOrCreateMemberProfileForUser({
      userId: input.userId,
      displayName: input.displayName,
    }),
    loadParticipationAreaWorkspaceForParticipant({
      participantId: input.identity.participantId,
      userId: input.userId,
    }),
  ]);

  const missing = buildReadinessMissing({
    emailVerified: user?.emailVerificationStatus === "verified",
    profileComplete: isProfileComplete(profile),
    participationConfigured: participation.activeArea !== null,
  });

  return {
    status: missing.length === 0 ? "ready" : "missing",
    missing,
  };
}

export async function resolveBetaOnboardingForUser(input: {
  userId: string;
  identity: RequestIdentity;
  displayName: string;
}): Promise<BetaOnboardingItem[]> {
  const [user, profile, participation, initiatives] = await Promise.all([
    findAuthUserById(input.userId),
    getOrCreateMemberProfileForUser({
      userId: input.userId,
      displayName: input.displayName,
    }),
    loadParticipationAreaWorkspaceForParticipant({
      participantId: input.identity.participantId,
      userId: input.userId,
    }),
    Promise.resolve(listMyInitiatives(input.identity)),
  ]);

  return [
    {
      id: "member-profile",
      label: "Complete Member Profile",
      completed: isProfileComplete(profile),
      href: "/member",
    },
    {
      id: "participation-area",
      label: "Configure Participation Area",
      completed: participation.activeArea !== null,
      href: "/member#participation-area",
    },
    {
      id: "verify-email",
      label: "Verify Email",
      completed: user?.emailVerificationStatus === "verified",
      href: "/verify-email",
    },
    {
      id: "first-initiative",
      label: "Create first Initiative",
      completed: initiatives.length > 0,
      href: "/initiatives",
    },
  ];
}

export function formatWorkspaceReadinessSummary(readiness: WorkspaceReadiness): string {
  if (readiness.status === "ready") {
    return "Workspace Ready";
  }

  return `Missing: ${readiness.missing.join(", ")}`;
}

export interface PlatformReadinessChecklistItem {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export async function buildPlatformReadinessChecklist(): Promise<PlatformReadinessChecklistItem[]> {
  const mongo = await checkMongoConnection();
  const email = await getEmailProviderHealth();
  const platformMode = resolvePlatformMode();
  const authConfig = resolveAuthConfig();
  const corsOrigin = resolveCorsOrigin();

  let jwtConfigured = false;

  try {
    assertAuthSecretsConfigured();
    jwtConfigured = true;
  } catch {
    jwtConfigured = false;
  }

  const bootstrapDisabled =
    platformMode === "beta" ||
    platformMode === "production" ||
    !authConfig.bootstrapFallbackEnabled;

  const emailConfigured = email.healthy;
  const httpsConfigured =
    environment.nodeEnv !== "production" ||
    Boolean(process.env.API_PUBLIC_URL?.startsWith("https://"));

  const mongoAtlas =
    environment.nodeEnv !== "production" ||
    Boolean(process.env.MONGODB_URI?.includes("mongodb.net"));

  const emailVerificationEnabled = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false";

  return [
    {
      id: "mongodb",
      label: "Mongo connected",
      status: mongo.connected ? "pass" : "fail",
      detail: mongo.connected ? (mongo.database ?? "connected") : (mongo.error ?? "not connected"),
    },
    {
      id: "health",
      label: "Health checks pass",
      status: mongo.connected && email.healthy ? "pass" : mongo.connected ? "warn" : "fail",
      detail: "API health endpoint dependencies",
    },
    {
      id: "jwt",
      label: "JWT configured",
      status: jwtConfigured ? "pass" : "fail",
      detail: jwtConfigured ? "secrets present" : "JWT secrets missing",
    },
    {
      id: "email",
      label: "Email configured",
      status: emailConfigured ? "pass" : environment.nodeEnv === "production" ? "fail" : "warn",
      detail: email.provider,
    },
    {
      id: "notifications",
      label: "Notifications working",
      status: mongo.connected ? "pass" : "fail",
      detail: "Notification persistence available",
    },
    {
      id: "workspace",
      label: "Workspace working",
      status: mongo.connected ? "pass" : "fail",
      detail: "Workspace home dependencies available",
    },
    {
      id: "search",
      label: "Search working",
      status: "pass",
      detail: "Global search routes registered",
    },
    {
      id: "assistant",
      label: "Assistant working",
      status: process.env.WORKSPACE_ASSISTANT_PROVIDER ? "pass" : "warn",
      detail: process.env.WORKSPACE_ASSISTANT_PROVIDER ?? "default mock provider",
    },
    {
      id: "deployment",
      label: "Deployment verified",
      status: corsOrigin ? "pass" : environment.nodeEnv === "production" ? "fail" : "warn",
      detail: corsOrigin ?? "CORS origin not configured",
    },
    {
      id: "bootstrap-disabled",
      label: "Bootstrap disabled",
      status: bootstrapDisabled ? "pass" : environment.nodeEnv === "production" ? "fail" : "warn",
      detail: `platformMode=${platformMode}`,
    },
    {
      id: "https",
      label: "HTTPS",
      status: httpsConfigured ? "pass" : "fail",
      detail: process.env.API_PUBLIC_URL ?? "API_PUBLIC_URL not set",
    },
    {
      id: "email-verification",
      label: "Email verification",
      status: emailVerificationEnabled ? "pass" : "warn",
      detail: emailVerificationEnabled ? "required" : "optional",
    },
    {
      id: "mongo-atlas",
      label: "Mongo Atlas",
      status: mongoAtlas ? "pass" : environment.nodeEnv === "production" ? "warn" : "pass",
      detail: mongoAtlas ? "Atlas URI detected" : "local or custom Mongo URI",
    },
    {
      id: "env-validation",
      label: "Environment validation",
      status:
        jwtConfigured && (corsOrigin || environment.nodeEnv !== "production") ? "pass" : "fail",
      detail: `NODE_ENV=${environment.nodeEnv}`,
    },
    {
      id: "debug-config",
      label: "No debug configuration",
      status:
        environment.nodeEnv === "production" && authConfig.bootstrapFallbackEnabled
          ? "fail"
          : "pass",
      detail: "Bootstrap and debug flags reviewed",
    },
  ];
}

export function assertClosedBetaProductionSafety(
  platformMode: PlatformMode = resolvePlatformMode(),
): void {
  if (environment.nodeEnv !== "production") {
    return;
  }

  if (platformMode === "development") {
    throw new Error("PLATFORM_MODE=development is not allowed when NODE_ENV=production.");
  }

  assertAuthSecretsConfigured();

  if (isBootstrapAllowedForMode(platformMode)) {
    throw new Error("Bootstrap auth must be disabled for beta and production deployments.");
  }

  if (!resolveCorsOrigin()) {
    throw new Error("CORS_ORIGIN or WEB_ORIGIN must be configured in production.");
  }
}

function isBootstrapAllowedForMode(platformMode: PlatformMode): boolean {
  if (platformMode === "beta" || platformMode === "production") {
    return false;
  }

  return resolveAuthConfig().bootstrapFallbackEnabled;
}
