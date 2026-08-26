/**
 * Pack 21E — BlogAdminSubscriberMessageQueued fan-out (Pack 21D patterns).
 *
 * Audience: selectedSubscriberIds from the Admin message snapshot, rechecked
 * for status === subscribed + blog_publications at send time.
 *
 * Ordering: claim pending → recheck eligibility → send → mark sent →
 * claim emailsSent increment → increment subscriber.emailsSent.
 *
 * Exactly-once limitation: SMTP-accepted-before-ledger-sent window may
 * duplicate on crash/retry; ledger `sent` is authoritative once persisted.
 */
import type {
  BlogAdminSubscriberMessageRecord,
  BlogSubscriberRecord,
} from "@hu/types";

import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import { resolveEmailConfig } from "../email/email.config.js";
import { sendTransactionalEmailAndAwait } from "../email/email.service.js";
import { isBlogSubscriberEligibleForPublicationDelivery } from "./blog-subscription-labels.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
} from "./blog-subscription-tokens.js";
import {
  claimBlogAdminSubscriberMessageDelivery,
  claimBlogAdminSubscriberMessageEmailsSentIncrement,
  markBlogAdminSubscriberMessageDeliveryFailed,
  markBlogAdminSubscriberMessageDeliverySent,
} from "./persistence/blog-admin-subscriber-message-delivery.repository.js";
import { findBlogAdminSubscriberMessageById } from "./persistence/blog-admin-subscriber-message.repository.js";
import {
  findBlogSubscriberById,
  upsertBlogSubscriberRecord,
} from "./persistence/blog-subscriber.repository.js";

export const BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID =
  "blog.admin-subscriber-message.v1" as const;

export const BLOG_ADMIN_SUBSCRIBER_MESSAGE_BATCH_SIZE = 50;
export const BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONCURRENCY = 3;
export const BLOG_ADMIN_SUBSCRIBER_MESSAGE_MAX_ATTEMPTS = 3;

export interface BlogAdminSubscriberMessageFanOutResult {
  skippedReason?: "invalid_payload" | "message_not_found";
  attempted: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
  skippedIneligible: number;
  skippedMaxAttempts: number;
}

export interface BlogAdminSubscriberMessageDeliveryDependencies {
  findMessageById(adminMessageId: string): Promise<BlogAdminSubscriberMessageRecord | null>;
  findSubscriberById(subscriberId: string): Promise<BlogSubscriberRecord | null>;
  upsertSubscriber(record: BlogSubscriberRecord): Promise<BlogSubscriberRecord>;
  sendAdminMessageEmail(input: {
    to: string;
    templateInput: Record<string, string | number | undefined>;
  }): Promise<{ emailSent: boolean; status: string; emailDeliveryError?: string }>;
}

function resolveAbsoluteCtaUrl(ctaUrl: string, publicSiteUrl: string): string {
  if (ctaUrl.startsWith("/")) {
    return `${publicSiteUrl.replace(/\/$/, "")}${ctaUrl}`;
  }
  return ctaUrl;
}

async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const limit = Math.max(1, concurrency);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]!);
    }
  });
  await Promise.all(runners);
}

async function defaultSend(input: {
  to: string;
  templateInput: Record<string, string | number | undefined>;
}): Promise<{ emailSent: boolean; status: string; emailDeliveryError?: string }> {
  const delivery = await sendTransactionalEmailAndAwait({
    to: input.to,
    template: "blog_subscription_admin_message",
    templateInput: input.templateInput,
  });
  return {
    emailSent: delivery.emailSent,
    status: delivery.status,
    ...(delivery.emailDeliveryError ? { emailDeliveryError: delivery.emailDeliveryError } : {}),
  };
}

function defaultDeps(): BlogAdminSubscriberMessageDeliveryDependencies {
  return {
    findMessageById: findBlogAdminSubscriberMessageById,
    findSubscriberById: findBlogSubscriberById,
    upsertSubscriber: upsertBlogSubscriberRecord,
    sendAdminMessageEmail: defaultSend,
  };
}

export function parseBlogAdminSubscriberMessageQueuedPayload(
  envelope: CanonicalDomainEventEnvelope,
): { adminMessageId: string } | null {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const adminMessageId =
    typeof payload.adminMessageId === "string" ? payload.adminMessageId.trim() : "";
  if (!adminMessageId) {
    return null;
  }
  return { adminMessageId };
}

async function deliverToSubscriber(input: {
  message: BlogAdminSubscriberMessageRecord;
  subscriberId: string;
  deps: BlogAdminSubscriberMessageDeliveryDependencies;
  stats: BlogAdminSubscriberMessageFanOutResult;
}): Promise<void> {
  const claim = await claimBlogAdminSubscriberMessageDelivery({
    adminMessageId: input.message.adminMessageId,
    subscriberId: input.subscriberId,
    maxAttempts: BLOG_ADMIN_SUBSCRIBER_MESSAGE_MAX_ATTEMPTS,
  });
  if (!claim.shouldSend) {
    if (claim.reason === "already_sent") {
      input.stats.skippedAlreadySent += 1;
    } else if (claim.reason === "max_attempts") {
      input.stats.skippedMaxAttempts += 1;
    }
    return;
  }

  const fresh = await input.deps.findSubscriberById(input.subscriberId);
  if (
    !fresh ||
    !isBlogSubscriberEligibleForPublicationDelivery(fresh.status) ||
    fresh.subscriptionType !== "blog_publications"
  ) {
    await markBlogAdminSubscriberMessageDeliveryFailed({
      adminMessageId: input.message.adminMessageId,
      subscriberId: input.subscriberId,
      failureCode: "subscriber_ineligible",
    });
    input.stats.skippedIneligible += 1;
    return;
  }

  input.stats.attempted += 1;

  const rawUnsubscribeToken = generateBlogSubscriptionRawToken();
  const unsubscribeTokenHash = hashBlogSubscriptionToken("unsubscribe", rawUnsubscribeToken);
  const config = resolveEmailConfig();
  const base = config.publicSiteUrl.replace(/\/$/, "");
  const unsubscribeUrl = `${base}/blog/subscribe/unsubscribe?token=${encodeURIComponent(rawUnsubscribeToken)}`;

  await input.deps.upsertSubscriber({
    ...fresh,
    unsubscribeTokenHash,
    updatedAt: new Date().toISOString(),
  });

  const templateInput: Record<string, string | number | undefined> = {
    subject: input.message.subject,
    message: input.message.message,
    unsubscribeUrl,
  };
  if (input.message.ctaLabel && input.message.ctaUrl) {
    templateInput.ctaLabel = input.message.ctaLabel;
    templateInput.ctaUrl = resolveAbsoluteCtaUrl(input.message.ctaUrl, base);
  }

  try {
    const delivery = await input.deps.sendAdminMessageEmail({
      to: fresh.emailNormalized,
      templateInput,
    });
    if (!delivery.emailSent) {
      await markBlogAdminSubscriberMessageDeliveryFailed({
        adminMessageId: input.message.adminMessageId,
        subscriberId: fresh.subscriberId,
        failureCode: delivery.emailDeliveryError ?? delivery.status ?? "send_failed",
      });
      input.stats.failed += 1;
      console.error(
        `[blog-admin-subscriber-message] send failed | adminMessageId=${input.message.adminMessageId} subscriberId=${fresh.subscriberId} status=${delivery.status}`,
      );
      return;
    }

    await markBlogAdminSubscriberMessageDeliverySent({
      adminMessageId: input.message.adminMessageId,
      subscriberId: fresh.subscriberId,
    });

    const shouldIncrement = await claimBlogAdminSubscriberMessageEmailsSentIncrement({
      adminMessageId: input.message.adminMessageId,
      subscriberId: fresh.subscriberId,
    });
    if (shouldIncrement) {
      const latest = await input.deps.findSubscriberById(fresh.subscriberId);
      if (latest) {
        await input.deps.upsertSubscriber({
          ...latest,
          emailsSent: latest.emailsSent + 1,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    input.stats.sent += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "send_exception";
    await markBlogAdminSubscriberMessageDeliveryFailed({
      adminMessageId: input.message.adminMessageId,
      subscriberId: fresh.subscriberId,
      failureCode: message,
    });
    input.stats.failed += 1;
    console.error(
      `[blog-admin-subscriber-message] send exception | adminMessageId=${input.message.adminMessageId} subscriberId=${fresh.subscriberId} reason=${message}`,
    );
  }
}

export async function fanOutBlogAdminSubscriberMessage(input: {
  envelope: CanonicalDomainEventEnvelope;
  deps?: BlogAdminSubscriberMessageDeliveryDependencies;
}): Promise<BlogAdminSubscriberMessageFanOutResult> {
  const deps = input.deps ?? defaultDeps();
  const stats: BlogAdminSubscriberMessageFanOutResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skippedAlreadySent: 0,
    skippedIneligible: 0,
    skippedMaxAttempts: 0,
  };

  const parsed = parseBlogAdminSubscriberMessageQueuedPayload(input.envelope);
  if (!parsed) {
    console.error(
      `[blog-admin-subscriber-message] invalid payload | eventId=${input.envelope.eventId}`,
    );
    return { ...stats, skippedReason: "invalid_payload" };
  }

  const message = await deps.findMessageById(parsed.adminMessageId);
  if (!message) {
    console.error(
      `[blog-admin-subscriber-message] message missing | adminMessageId=${parsed.adminMessageId}`,
    );
    return { ...stats, skippedReason: "message_not_found" };
  }

  const ids = [...message.selectedSubscriberIds];
  for (let offset = 0; offset < ids.length; offset += BLOG_ADMIN_SUBSCRIBER_MESSAGE_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + BLOG_ADMIN_SUBSCRIBER_MESSAGE_BATCH_SIZE);
    await mapPool(batch, BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONCURRENCY, async (subscriberId) => {
      await deliverToSubscriber({
        message,
        subscriberId,
        deps,
        stats,
      });
    });
  }

  console.info(
    `[blog-admin-subscriber-message] complete | adminMessageId=${message.adminMessageId} attempted=${stats.attempted} sent=${stats.sent} failed=${stats.failed} skippedSent=${stats.skippedAlreadySent} skippedIneligible=${stats.skippedIneligible}`,
  );
  return stats;
}
