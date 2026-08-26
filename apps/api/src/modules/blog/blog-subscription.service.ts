/**
 * Pack 21A — public Blog subscription lifecycle (subscribe / confirm / unsubscribe).
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
import { sendTransactionalEmail, sendTransactionalEmailAndAwait } from "../email/email.service.js";
import { recipientDomainForLogs } from "../email/email-safety-guards.js";
import { BlogValidationError } from "./blog.errors.js";
import {
  isValidBlogSubscriptionEmail,
  normalizeBlogSubscriptionEmail,
  toBlogSubscriptionEmailDisplay,
} from "./blog-subscription-email.js";
import { assertBlogSubscriptionSubscribeAllowed } from "./blog-subscription-rate-limit.js";
import { resolveEffectiveBlogSubscriptionWelcomeMessage } from "./blog-subscription-settings.admin.service.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
  isBlogSubscriptionConfirmExpired,
  resolveBlogSubscriptionConfirmExpiresAt,
} from "./blog-subscription-tokens.js";
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

function issueTokens(): {
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

async function sendConfirmationEmail(input: {
  to: string;
  rawConfirmToken: string;
  rawUnsubscribeToken: string;
}): Promise<void> {
  const config = resolveEmailConfig();
  const base = config.publicSiteUrl.replace(/\/$/, "");
  const confirmationUrl = `${base}/blog/subscribe/confirm?token=${encodeURIComponent(input.rawConfirmToken)}`;
  const unsubscribeUrl = `${base}/blog/subscribe/unsubscribe?token=${encodeURIComponent(input.rawUnsubscribeToken)}`;

  await sendTransactionalEmail({
    to: input.to,
    template: "blog_subscription_confirm",
    templateInput: {
      confirmationUrl,
      unsubscribeUrl,
    },
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "confirm_email_failed";
    console.error(
      `[blog-subscription] confirm email failed | domain=${recipientDomainForLogs(input.to)} reason=${message}`,
    );
  });
}

/**
 * Public subscribe — always returns a generic accepted message (no existence oracle).
 */
export async function requestBlogSubscription(input: {
  email: unknown;
  ipKey: string;
}): Promise<PublicBlogSubscribeResponse> {
  if (typeof input.email !== "string" || !isValidBlogSubscriptionEmail(input.email)) {
    throw new BlogValidationError("A valid email address is required.");
  }

  const emailNormalized = normalizeBlogSubscriptionEmail(input.email);
  const emailDisplay = toBlogSubscriptionEmailDisplay(input.email);

  assertBlogSubscriptionSubscribeAllowed({
    emailNormalized,
    ipKey: input.ipKey,
  });

  const existing = await findBlogSubscriberByNormalizedEmail(emailNormalized);
  const now = new Date().toISOString();
  const participantId = await resolveOptionalParticipantId(emailNormalized);

  if (existing?.status === "subscribed") {
    return { accepted: true, message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  if (existing) {
    const tokens = issueTokens();
    const updated: BlogSubscriberRecord = {
      subscriberId: existing.subscriberId,
      emailNormalized: existing.emailNormalized,
      emailDisplay,
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      ...(participantId
        ? { participantId }
        : existing.participantId
          ? { participantId: existing.participantId }
          : {}),
      ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
      emailsSent: existing.emailsSent,
      // Pack 21B — new confirmation lifecycle may receive a new Welcome email.
      confirmTokenHash: tokens.confirmTokenHash,
      confirmTokenExpiresAt: tokens.confirmTokenExpiresAt,
      unsubscribeTokenHash: tokens.unsubscribeTokenHash,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    await upsertBlogSubscriberRecord(updated);
    await sendConfirmationEmail({
      to: emailNormalized,
      rawConfirmToken: tokens.rawConfirmToken,
      rawUnsubscribeToken: tokens.rawUnsubscribeToken,
    });
    return { accepted: true, message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  const subscriberId = randomUUID();
  const tokens = issueTokens();
  const created: BlogSubscriberRecord = {
    subscriberId,
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
  await sendConfirmationEmail({
    to: emailNormalized,
    rawConfirmToken: tokens.rawConfirmToken,
    rawUnsubscribeToken: tokens.rawUnsubscribeToken,
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
