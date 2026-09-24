/**
 * Pack 21A — public Blog subscription lifecycle (subscribe / confirm / unsubscribe).
 * EMAIL SECURITY 02B — durable abuse limits + Turnstile + privacy-safe audit.
 */
import { randomUUID } from "node:crypto";

import type {
  BlogSubscriberRecord,
  PublicBlogSubscribeResponse,
  PublicBlogSubscriptionConfirmResponse,
  PublicBlogSubscriptionUnsubscribeResponse,
} from "@hu/types";

import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { findAuthUserByEmail } from "../auth/auth-user.repository.js";
import { resolveEmailConfig } from "../email/email.config.js";
import { buildBlogListUnsubscribeHeaders } from "../email/email-list-headers.js";
import { sendTransactionalEmail, sendTransactionalEmailAndAwait } from "../email/email.service.js";
import { recipientDomainForLogs } from "../email/email-safety-guards.js";
import { BlogValidationError } from "./blog.errors.js";
import {
  isValidBlogSubscriptionEmail,
  normalizeBlogSubscriptionEmail,
  toBlogSubscriptionEmailDisplay,
} from "./blog-subscription-email.js";
import {
  hashBlogSubscriptionSourceIp,
  hashRecipientEmail,
} from "./blog-subscription-privacy-hash.js";
import { createBlogSubscriptionRateLimitError } from "./blog-subscription-rate-limit.js";
import { resolveEffectiveBlogSubscriptionWelcomeMessage } from "./blog-subscription-settings.admin.service.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
  isBlogSubscriptionConfirmExpired,
  resolveBlogSubscriptionConfirmExpiresAt,
} from "./blog-subscription-tokens.js";
import { verifyBlogSubscriptionTurnstile } from "./blog-subscription-turnstile.js";
import {
  authorizeBlogSubscriptionConfirmationSend,
  consumeBlogSubscriptionIpBudget,
  isBlogSubscriptionAbuseUnavailableError,
} from "./persistence/blog-subscription-abuse.repository.js";
import { recordBlogSubscriptionSecurityEvent } from "./persistence/blog-subscription-security-event.repository.js";
import {
  claimBlogSubscriberWelcomeSend,
  completeBlogSubscriberWelcomeSend,
  findBlogSubscriberByConfirmTokenHash,
  findBlogSubscriberByNormalizedEmail,
  findBlogSubscriberByUnsubscribeTokenHash,
  releaseBlogSubscriberWelcomeSendClaim,
  setBlogSubscriberUnsubscribeTokenHash,
  upsertBlogSubscriberRecord,
} from "./persistence/blog-subscriber.repository.js";

const GENERIC_SUBSCRIBE_MESSAGE = "Check your email to confirm your subscription.";
const GENERIC_CONFIRM_MESSAGE = "Your Blog subscription is confirmed.";
const GENERIC_UNSUBSCRIBE_MESSAGE = "You have been unsubscribed from Blog publications.";
const GENERIC_TOKEN_MESSAGE = "This link is invalid or has expired.";
const GENERIC_UNAVAILABLE_MESSAGE =
  "Unable to process your subscription right now. Please try again later.";

async function resolveOptionalParticipantId(emailNormalized: string): Promise<string | undefined> {
  if (process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true" || !isMongoConfigured()) {
    return undefined;
  }
  try {
    const user = await findAuthUserByEmail(emailNormalized);
    return user?.memberId?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Pack 21G / Pack 21A — shared token issuance for confirmation lifecycle. */
export function issueBlogSubscriptionTokens(): {
  rawConfirmToken: string;
  confirmTokenHash: string;
  confirmTokenExpiresAt: string;
  rawUnsubscribeToken: string;
  unsubscribeTokenHash: string;
} {
  const rawConfirmToken = generateBlogSubscriptionRawToken();
  const rawUnsubscribeToken = generateBlogSubscriptionRawToken();
  return {
    rawConfirmToken,
    confirmTokenHash: hashBlogSubscriptionToken("confirm", rawConfirmToken),
    confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
    rawUnsubscribeToken,
    unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", rawUnsubscribeToken),
  };
}

/** Pack 21G — unsubscribe-only token for confirmed historical imports (no confirm email). */
export function issueBlogSubscriptionUnsubscribeToken(): {
  rawUnsubscribeToken: string;
  unsubscribeTokenHash: string;
} {
  const rawUnsubscribeToken = generateBlogSubscriptionRawToken();
  return {
    rawUnsubscribeToken,
    unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", rawUnsubscribeToken),
  };
}

/** Pack 21A / 21G — canonical confirmation email (does not increment emailsSent). */
export async function sendBlogSubscriptionConfirmationEmail(input: {
  to: string;
  rawConfirmToken: string;
  rawUnsubscribeToken: string;
}): Promise<string | undefined> {
  const config = resolveEmailConfig();
  const base = config.publicSiteUrl.replace(/\/$/, "");
  const confirmationUrl = `${base}/blog/subscribe/confirm?token=${encodeURIComponent(input.rawConfirmToken)}`;
  const unsubscribeUrl = `${base}/blog/subscribe/unsubscribe?token=${encodeURIComponent(input.rawUnsubscribeToken)}`;

  try {
    return await sendTransactionalEmail({
      to: input.to,
      template: "blog_subscription_confirm",
      templateInput: {
        confirmationUrl,
        unsubscribeUrl,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "confirm_email_failed";
    console.error(
      `[blog-subscription] confirm email failed | domain=${recipientDomainForLogs(input.to)} reason=${message}`,
    );
    return undefined;
  }
}

/**
 * Public subscribe — always returns a generic accepted message (no existence oracle).
 * EMAIL SECURITY 02B: validate → IP budget → Turnstile → state/email auth → send.
 */
export async function requestBlogSubscription(input: {
  email: unknown;
  turnstileToken?: unknown;
  ipKey: string;
  correlationId?: string;
}): Promise<PublicBlogSubscribeResponse> {
  const sourceIpHash = hashBlogSubscriptionSourceIp(input.ipKey);
  const correlationId = input.correlationId?.trim() || undefined;

  const audit = async (event: {
    outcome: "allowed_send" | "allowed_no_send" | "blocked";
    reason:
      | "invalid_email"
      | "ip_limit"
      | "email_cooldown"
      | "email_daily_cap"
      | "turnstile_missing"
      | "turnstile_invalid"
      | "turnstile_unavailable"
      | "subscribed_noop"
      | "pending_cooldown"
      | "mongo_unavailable"
      | "ok_send"
      | "ok_no_send";
    recipientHash: string;
    emailAuditId?: string;
    template?: string;
  }) => {
    await recordBlogSubscriptionSecurityEvent({
      outcome: event.outcome,
      reason: event.reason,
      recipientHash: event.recipientHash,
      sourceIpHash,
      ...(correlationId ? { correlationId } : {}),
      ...(event.emailAuditId ? { emailAuditId: event.emailAuditId } : {}),
      ...(event.template ? { template: event.template } : {}),
    });
  };

  if (typeof input.email !== "string" || !isValidBlogSubscriptionEmail(input.email)) {
    await audit({
      outcome: "blocked",
      reason: "invalid_email",
      recipientHash: "invalid",
    });
    throw new BlogValidationError("A valid email address is required.");
  }

  const emailNormalized = normalizeBlogSubscriptionEmail(input.email);
  const emailDisplay = toBlogSubscriptionEmailDisplay(input.email);
  const recipientHash = hashRecipientEmail(emailNormalized);

  try {
    const ipAllowed = await consumeBlogSubscriptionIpBudget(sourceIpHash);
    if (!ipAllowed) {
      await audit({ outcome: "blocked", reason: "ip_limit", recipientHash });
      throw createBlogSubscriptionRateLimitError();
    }
  } catch (error) {
    if (isBlogSubscriptionAbuseUnavailableError(error)) {
      await audit({ outcome: "blocked", reason: "mongo_unavailable", recipientHash });
      throw new BlogValidationError(GENERIC_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }

  const turnstile = await verifyBlogSubscriptionTurnstile({
    token: input.turnstileToken,
    remoteIp: input.ipKey,
  });
  if (!turnstile.ok) {
    await audit({ outcome: "blocked", reason: turnstile.reason, recipientHash });
    if (turnstile.reason === "turnstile_missing") {
      throw new BlogValidationError("Security verification is required.");
    }
    if (turnstile.reason === "turnstile_unavailable") {
      throw new BlogValidationError(GENERIC_UNAVAILABLE_MESSAGE);
    }
    throw new BlogValidationError("Security verification failed. Please try again.");
  }

  let existing: BlogSubscriberRecord | null;
  try {
    existing = await findBlogSubscriberByNormalizedEmail(emailNormalized);
  } catch {
    await audit({ outcome: "blocked", reason: "mongo_unavailable", recipientHash });
    throw new BlogValidationError(GENERIC_UNAVAILABLE_MESSAGE);
  }

  if (existing?.status === "subscribed") {
    await audit({
      outcome: "allowed_no_send",
      reason: "subscribed_noop",
      recipientHash,
    });
    return { accepted: true, message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  let sendAuth: Awaited<ReturnType<typeof authorizeBlogSubscriptionConfirmationSend>>;
  try {
    sendAuth = await authorizeBlogSubscriptionConfirmationSend(recipientHash);
  } catch (error) {
    if (isBlogSubscriptionAbuseUnavailableError(error)) {
      await audit({ outcome: "blocked", reason: "mongo_unavailable", recipientHash });
      throw new BlogValidationError(GENERIC_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }

  if (!sendAuth.allowed) {
    const pending =
      existing?.status === "not_confirmed" && sendAuth.reason === "email_cooldown";
    await audit({
      outcome: "allowed_no_send",
      reason: pending ? "pending_cooldown" : sendAuth.reason,
      recipientHash,
    });
    return { accepted: true, message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  const now = new Date().toISOString();
  const participantId = await resolveOptionalParticipantId(emailNormalized);
  const tokens = issueBlogSubscriptionTokens();

  if (existing) {
    const updated: BlogSubscriberRecord = {
      subscriberId: existing.subscriberId,
      emailNormalized: existing.emailNormalized,
      emailDisplay,
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      ...(existing.displayName ? { displayName: existing.displayName } : {}),
      ...(participantId
        ? { participantId }
        : existing.participantId
          ? { participantId: existing.participantId }
          : {}),
      ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
      emailsSent: existing.emailsSent,
      confirmTokenHash: tokens.confirmTokenHash,
      confirmTokenExpiresAt: tokens.confirmTokenExpiresAt,
      unsubscribeTokenHash: tokens.unsubscribeTokenHash,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    await upsertBlogSubscriberRecord(updated);
  } else {
    const created: BlogSubscriberRecord = {
      subscriberId: randomUUID(),
      emailNormalized,
      emailDisplay,
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      ...(participantId ? { participantId } : {}),
      emailsSent: 0,
      confirmTokenHash: tokens.confirmTokenHash,
      confirmTokenExpiresAt: tokens.confirmTokenExpiresAt,
      unsubscribeTokenHash: tokens.unsubscribeTokenHash,
      createdAt: now,
      updatedAt: now,
    };
    await upsertBlogSubscriberRecord(created);
  }

  const emailAuditId = await sendBlogSubscriptionConfirmationEmail({
    to: emailNormalized,
    rawConfirmToken: tokens.rawConfirmToken,
    rawUnsubscribeToken: tokens.rawUnsubscribeToken,
  });

  await audit({
    outcome: "allowed_send",
    reason: "ok_send",
    recipientHash,
    ...(emailAuditId ? { emailAuditId } : {}),
    template: "blog_subscription_confirm",
  });

  return { accepted: true, message: GENERIC_SUBSCRIBE_MESSAGE };
}

async function sendWelcomeEmailBestEffort(input: {
  subscriber: BlogSubscriberRecord;
}): Promise<void> {
  if (input.subscriber.welcomeSentAt) {
    return;
  }
  if (input.subscriber.status !== "subscribed") {
    return;
  }

  // Pack 21F — claim before send so concurrent confirmations cannot double-deliver.
  const claimed = await claimBlogSubscriberWelcomeSend(input.subscriber.subscriberId);
  if (!claimed) {
    return;
  }

  const rawUnsubscribeToken = generateBlogSubscriptionRawToken();
  const unsubscribeTokenHash = hashBlogSubscriptionToken("unsubscribe", rawUnsubscribeToken);
  const config = resolveEmailConfig();
  const base = config.publicSiteUrl.replace(/\/$/, "");
  const unsubscribeUrl = `${base}/blog/subscribe/unsubscribe?token=${encodeURIComponent(rawUnsubscribeToken)}`;
  const blogUrl = `${base}/blog`;
  const welcomeMessage = await resolveEffectiveBlogSubscriptionWelcomeMessage();

  // Persist rotated unsubscribe token before send so the link works even if send is slow.
  await setBlogSubscriberUnsubscribeTokenHash({
    subscriberId: input.subscriber.subscriberId,
    unsubscribeTokenHash,
  });

  try {
    const delivery = await sendTransactionalEmailAndAwait({
      to: input.subscriber.emailNormalized,
      template: "blog_subscription_welcome",
      templateInput: {
        welcomeMessage,
        blogUrl,
        unsubscribeUrl,
      },
      listHeaders: buildBlogListUnsubscribeHeaders(rawUnsubscribeToken),
    });

    if (!delivery.emailSent) {
      await releaseBlogSubscriberWelcomeSendClaim(input.subscriber.subscriberId);
      console.error(
        `[blog-subscription] welcome email not sent | domain=${recipientDomainForLogs(input.subscriber.emailNormalized)} status=${delivery.status}`,
      );
      return;
    }

    await completeBlogSubscriberWelcomeSend(input.subscriber.subscriberId);
  } catch (error: unknown) {
    await releaseBlogSubscriberWelcomeSendClaim(input.subscriber.subscriberId).catch(() => undefined);
    const message = error instanceof Error ? error.message : "welcome_email_failed";
    console.error(
      `[blog-subscription] welcome email failed | domain=${recipientDomainForLogs(input.subscriber.emailNormalized)} reason=${message}`,
    );
  }
}

export async function confirmBlogSubscription(input: {
  token: unknown;
}): Promise<PublicBlogSubscriptionConfirmResponse> {
  if (typeof input.token !== "string" || input.token.trim().length < 16) {
    throw new BlogValidationError(GENERIC_TOKEN_MESSAGE);
  }
  const rawToken = input.token.trim();
  const confirmTokenHash = hashBlogSubscriptionToken("confirm", rawToken);
  const existing = await findBlogSubscriberByConfirmTokenHash(confirmTokenHash);

  if (!existing) {
    throw new BlogValidationError(GENERIC_TOKEN_MESSAGE);
  }

  if (existing.status === "subscribed") {
    // Already confirmed — do not resend Welcome (send-once / no replay).
    return { confirmed: true, message: GENERIC_CONFIRM_MESSAGE };
  }

  if (isBlogSubscriptionConfirmExpired(existing.confirmTokenExpiresAt)) {
    throw new BlogValidationError(GENERIC_TOKEN_MESSAGE);
  }

  const now = new Date().toISOString();
  const confirmed: BlogSubscriberRecord = {
    subscriberId: existing.subscriberId,
    emailNormalized: existing.emailNormalized,
    emailDisplay: existing.emailDisplay,
    ...(existing.displayName ? { displayName: existing.displayName } : {}),
    status: "subscribed",
    subscriptionType: existing.subscriptionType,
    ...(existing.participantId ? { participantId: existing.participantId } : {}),
    ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
    subscribedAt: existing.subscribedAt ?? now,
    confirmedAt: now,
    emailsSent: existing.emailsSent,
    // welcomeSentAt intentionally omitted — new confirmation lifecycle.
    unsubscribeTokenHash: existing.unsubscribeTokenHash,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await upsertBlogSubscriberRecord(confirmed);

  // Confirmation succeeds even if Welcome email fails.
  await sendWelcomeEmailBestEffort({ subscriber: confirmed });

  // Pack 22E.1 — durable Admin inbox signal (skipped when outbox/Mongo unavailable).
  const { emitBlogSubscriptionConfirmed } = await import(
    "../admin-notifications/events/blog-subscription-confirmed.event.js"
  );
  await emitBlogSubscriptionConfirmed({
    subscriberId: confirmed.subscriberId,
    displayLabel: confirmed.emailDisplay,
    confirmedAt: now,
    actorId: confirmed.participantId ?? null,
  });

  return { confirmed: true, message: GENERIC_CONFIRM_MESSAGE };
}

export async function unsubscribeBlogSubscription(input: {
  token: unknown;
}): Promise<PublicBlogSubscriptionUnsubscribeResponse> {
  if (typeof input.token !== "string" || input.token.trim().length < 16) {
    throw new BlogValidationError(GENERIC_TOKEN_MESSAGE);
  }
  const rawToken = input.token.trim();
  const unsubscribeTokenHash = hashBlogSubscriptionToken("unsubscribe", rawToken);
  const existing = await findBlogSubscriberByUnsubscribeTokenHash(unsubscribeTokenHash);

  if (!existing) {
    throw new BlogValidationError(GENERIC_TOKEN_MESSAGE);
  }

  if (existing.status === "unsubscribed") {
    return { unsubscribed: true, message: GENERIC_UNSUBSCRIBE_MESSAGE };
  }

  const now = new Date().toISOString();
  const updated: BlogSubscriberRecord = {
    subscriberId: existing.subscriberId,
    emailNormalized: existing.emailNormalized,
    emailDisplay: existing.emailDisplay,
    ...(existing.displayName ? { displayName: existing.displayName } : {}),
    status: "unsubscribed",
    subscriptionType: existing.subscriptionType,
    ...(existing.participantId ? { participantId: existing.participantId } : {}),
    ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
    ...(existing.subscribedAt ? { subscribedAt: existing.subscribedAt } : {}),
    ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
    ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
    unsubscribedAt: now,
    emailsSent: existing.emailsSent,
    unsubscribeTokenHash: existing.unsubscribeTokenHash,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await upsertBlogSubscriberRecord(updated);
  return { unsubscribed: true, message: GENERIC_UNSUBSCRIBE_MESSAGE };
}

/** Test helper — expose hash for assert-only tests without logging raw tokens. */
export function hashBlogSubscriptionTokenForTests(
  purpose: "confirm" | "unsubscribe",
  rawToken: string,
): string {
  return hashBlogSubscriptionToken(purpose, rawToken);
}
