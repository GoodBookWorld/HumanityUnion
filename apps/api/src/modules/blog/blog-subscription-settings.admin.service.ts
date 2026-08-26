/**
 * Pack 21B — Admin Blog subscription welcome settings.
 */
import type { BlogSubscriptionSettingsResponse } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE,
  sanitizeBlogSubscriptionWelcomeMessage,
} from "./blog-subscription-welcome.js";
import {
  findBlogSubscriptionSettings,
  upsertBlogSubscriptionSettings,
} from "./persistence/blog-subscription-settings.repository.js";

/** Pack 21B — memory-store unit tests without Auth Mongo. */
let adminActorOverrideForTests: {
  userId: string;
  participantId: string;
  role: "admin" | "member";
} | null = null;

export function setBlogSubscriptionSettingsAdminActorOverrideForTests(
  actor: { userId: string; participantId: string; role: "admin" | "member" } | null,
): void {
  adminActorOverrideForTests = actor;
}

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  if (adminActorOverrideForTests) {
    if (adminActorOverrideForTests.userId !== userId) {
      throw new AdministrationUnauthorizedError();
    }
    if (adminActorOverrideForTests.role !== "admin") {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return {
      userId: adminActorOverrideForTests.userId,
      participantId: adminActorOverrideForTests.participantId,
    };
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

/** Effective welcome message for email send (default when unset). */
export async function resolveEffectiveBlogSubscriptionWelcomeMessage(): Promise<string> {
  const stored = await findBlogSubscriptionSettings();
  const message = stored?.welcomeMessage?.trim();
  return message && message.length > 0 ? message : DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE;
}

export async function getAdminBlogSubscriptionSettings(input: {
  actorUserId: string;
}): Promise<BlogSubscriptionSettingsResponse> {
  await assertAdminActor(input.actorUserId);
  const stored = await findBlogSubscriptionSettings();
  if (!stored) {
    return {
      welcomeMessage: DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE,
      isDefault: true,
    };
  }
  return {
    welcomeMessage: stored.welcomeMessage,
    isDefault: false,
    updatedAt: stored.updatedAt,
    ...(stored.updatedByParticipantId
      ? { updatedByParticipantId: stored.updatedByParticipantId }
      : {}),
  };
}

export async function updateAdminBlogSubscriptionSettings(input: {
  actorUserId: string;
  body: unknown;
}): Promise<BlogSubscriptionSettingsResponse> {
  const admin = await assertAdminActor(input.actorUserId);
  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Settings body is required.");
  }
  const body = input.body as Record<string, unknown>;
  let welcomeMessage: string;
  try {
    welcomeMessage = sanitizeBlogSubscriptionWelcomeMessage(body.welcomeMessage);
  } catch (error) {
    throw new AdministrationValidationError(
      error instanceof Error ? error.message : "Invalid welcomeMessage.",
    );
  }

  const now = new Date().toISOString();
  await upsertBlogSubscriptionSettings({
    welcomeMessage,
    updatedAt: now,
    updatedByParticipantId: admin.participantId,
  });

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.subscription_settings.update",
    targetType: "blog_subscription_settings",
    targetId: "blog_subscription_settings",
    scope: { scopeType: "blog", scopeId: "subscription_settings" },
    afterSummary: `welcomeMessageLength=${welcomeMessage.length}`,
  });

  return {
    welcomeMessage,
    isDefault: false,
    updatedAt: now,
    updatedByParticipantId: admin.participantId,
  };
}
