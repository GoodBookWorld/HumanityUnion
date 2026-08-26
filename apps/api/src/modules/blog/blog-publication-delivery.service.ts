/**
 * Pack 21D — BlogPostPublished → subscriber publication email fan-out.
 *
 * Product rules:
 * - One delivery email per (postId, subscriberId) for the post's lifetime.
 * - Archive / restore / content edit / republish of the same postId does not
 *   create a second send when ledger already has `sent`.
 * - Eligibility is subscription status only (subscribed + blog_publications).
 * - Confirmation email never increments emailsSent; publication digest does
 *   after successful send, once per ledger row.
 *
 * Retry boundary:
 * - Outer: outbox processed-events claim. If the consumer throws mid-run,
 *   the claim is released and the event can re-run; sent ledger rows are skipped.
 * - Inner: per-subscriber maxAttempts (default 3). Individual failures do not
 *   fail the whole consumer; exhausted failures stay `failed` (no campaign
 *   retry scheduler in this Pack).
 * - MailDeliveryService may classify SMTP retries internally; we await one
 *   delivery attempt per claim and do not stack an aggressive outer SMTP loop.
 *
 * Ordering: claim pending → recheck eligibility → send → mark sent →
 * claim emailsSent increment → increment subscriber.emailsSent.
 *
 * Exactly-once limitation: if SMTP accepts mail and the process dies before
 * ledger is marked `sent`, a later retry may send again. Ledger `sent` is the
 * authoritative duplicate guard once persisted.
 */
import type { BlogPost, BlogSubscriberRecord } from "@hu/types";

import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import { resolveEmailConfig } from "../email/email.config.js";
import { sendTransactionalEmailAndAwait } from "../email/email.service.js";
import { findBlogPostById } from "./persistence/blog.repository.js";
import {
  claimBlogPublicationDelivery,
  claimBlogPublicationEmailsSentIncrement,
  markBlogPublicationDeliveryFailed,
  markBlogPublicationDeliverySent,
} from "./persistence/blog-publication-delivery.repository.js";
import {
  findBlogSubscriberById,
  listEligibleBlogPublicationSubscribersBatch,
  upsertBlogSubscriberRecord,
} from "./persistence/blog-subscriber.repository.js";
import { isBlogSubscriberEligibleForPublicationDelivery } from "./blog-subscription-labels.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
} from "./blog-subscription-tokens.js";

export const BLOG_PUBLICATION_DELIVERY_CONSUMER_ID = "blog.publication-delivery.v1" as const;

/** Modest batch size — avoids unbounded loads and memory spikes. */
export const BLOG_PUBLICATION_DELIVERY_BATCH_SIZE = 50;

/**
 * Conservative per-batch concurrency — MailDeliveryService + SMTP capacity.
 * Sequential would also be safe; 3 keeps fan-out moving without stampedes.
 */
export const BLOG_PUBLICATION_DELIVERY_CONCURRENCY = 3;

/** Bounded claim retries per (post, subscriber) across outbox re-dispatches. */
export const BLOG_PUBLICATION_DELIVERY_MAX_ATTEMPTS = 3;

export interface BlogPostPublishedDeliveryPayload {
  postId: string;
  authorParticipantId: string;
  publishedByParticipantId: string;
  publishedVersion: number;
  slug: string;
}

export function isBlogPostPubliclyDeliverable(post: BlogPost, nowIso = new Date().toISOString()): boolean {
  if (post.status !== "published") {
    return false;
  }
  if (post.administrativelyBlocked === true) {
    return false;
  }
  if (!post.publishedAt || post.publishedAt > nowIso) {
    return false;
  }
  return true;
}

export function parseBlogPostPublishedDeliveryPayload(
  envelope: CanonicalDomainEventEnvelope,
): BlogPostPublishedDeliveryPayload | null {
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const postId = typeof payload.postId === "string" ? payload.postId.trim() : "";
  const slug = typeof payload.slug === "string" ? payload.slug.trim() : "";
  const authorParticipantId =
    typeof payload.authorParticipantId === "string" ? payload.authorParticipantId.trim() : "";
  const publishedByParticipantId =
    typeof payload.publishedByParticipantId === "string"
      ? payload.publishedByParticipantId.trim()
      : "";
  const publishedVersion =
    typeof payload.publishedVersion === "number" ? payload.publishedVersion : Number.NaN;
  if (!postId || !slug || !authorParticipantId || !publishedByParticipantId) {
    return null;
  }
  if (!Number.isFinite(publishedVersion)) {
    return null;
  }
  return {
    postId,
    slug,
    authorParticipantId,
    publishedByParticipantId,
    publishedVersion,
  };
}

function truncateExcerpt(excerpt: string, max = 280): string {
  const cleaned = excerpt.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function isSafeHttpsImageUrl(url: string | undefined): url is string {
  if (!url?.trim()) {
    return false;
  }
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
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

export interface BlogPublicationDeliveryFanOutResult {
  skippedReason?: "invalid_payload" | "post_not_deliverable";
  attempted: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
  skippedIneligible: number;
  skippedMaxAttempts: number;
}

export interface BlogPublicationDeliveryDependencies {
  findPostById(postId: string): Promise<BlogPost | null>;
  listEligibleBatch(input: {
    afterSubscriberId?: string;
    limit: number;
  }): Promise<BlogSubscriberRecord[]>;
  findSubscriberById(subscriberId: string): Promise<BlogSubscriberRecord | null>;
  upsertSubscriber(record: BlogSubscriberRecord): Promise<BlogSubscriberRecord>;
  sendPublicationEmail(input: {
    to: string;
    templateInput: Record<string, string | number | undefined>;
  }): Promise<{ emailSent: boolean; status: string; emailDeliveryError?: string }>;
}

async function defaultSendPublicationEmail(input: {
  to: string;
  templateInput: Record<string, string | number | undefined>;
}): Promise<{ emailSent: boolean; status: string; emailDeliveryError?: string }> {
  const delivery = await sendTransactionalEmailAndAwait({
    to: input.to,
    template: "blog_publication_digest",
    templateInput: input.templateInput,
  });
  return {
    emailSent: delivery.emailSent,
    status: delivery.status,
    ...(delivery.emailDeliveryError ? { emailDeliveryError: delivery.emailDeliveryError } : {}),
  };
}

function defaultDeps(): BlogPublicationDeliveryDependencies {
  return {
    findPostById: findBlogPostById,
    listEligibleBatch: listEligibleBlogPublicationSubscribersBatch,
    findSubscriberById: findBlogSubscriberById,
    upsertSubscriber: upsertBlogSubscriberRecord,
    sendPublicationEmail: defaultSendPublicationEmail,
  };
}

async function deliverToSubscriber(input: {
  post: BlogPost;
  postId: string;
  publicationUrl: string;
  coverImageUrl?: string;
  deps: BlogPublicationDeliveryDependencies;
  subscriber: BlogSubscriberRecord;
  stats: BlogPublicationDeliveryFanOutResult;
}): Promise<void> {
  const claim = await claimBlogPublicationDelivery({
    postId: input.postId,
    subscriberId: input.subscriber.subscriberId,
    maxAttempts: BLOG_PUBLICATION_DELIVERY_MAX_ATTEMPTS,
  });

  if (!claim.shouldSend) {
    if (claim.reason === "already_sent") {
      input.stats.skippedAlreadySent += 1;
    } else if (claim.reason === "max_attempts") {
      input.stats.skippedMaxAttempts += 1;
    }
    return;
  }

  const fresh = await input.deps.findSubscriberById(input.subscriber.subscriberId);
  if (
    !fresh ||
    !isBlogSubscriberEligibleForPublicationDelivery(fresh.status) ||
    fresh.subscriptionType !== "blog_publications"
  ) {
    await markBlogPublicationDeliveryFailed({
      postId: input.postId,
      subscriberId: input.subscriber.subscriberId,
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

  const withRotatedToken: BlogSubscriberRecord = {
    ...fresh,
    unsubscribeTokenHash,
    updatedAt: new Date().toISOString(),
  };
  await input.deps.upsertSubscriber(withRotatedToken);

  try {
    const delivery = await input.deps.sendPublicationEmail({
      to: fresh.emailNormalized,
      templateInput: {
        title: input.post.title,
        excerpt: truncateExcerpt(input.post.excerpt || ""),
        publicationUrl: input.publicationUrl,
        unsubscribeUrl,
        ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
      },
    });

    if (!delivery.emailSent) {
      await markBlogPublicationDeliveryFailed({
        postId: input.postId,
        subscriberId: fresh.subscriberId,
        failureCode: delivery.emailDeliveryError ?? delivery.status ?? "send_failed",
      });
      input.stats.failed += 1;
      console.error(
        `[blog-publication-delivery] send failed | postId=${input.postId} subscriberId=${fresh.subscriberId} status=${delivery.status}`,
      );
      return;
    }

    await markBlogPublicationDeliverySent({
      postId: input.postId,
      subscriberId: fresh.subscriberId,
    });

    const shouldIncrement = await claimBlogPublicationEmailsSentIncrement({
      postId: input.postId,
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
    await markBlogPublicationDeliveryFailed({
      postId: input.postId,
      subscriberId: fresh.subscriberId,
      failureCode: message,
    });
    input.stats.failed += 1;
    console.error(
      `[blog-publication-delivery] send exception | postId=${input.postId} subscriberId=${fresh.subscriberId} reason=${message}`,
    );
  }
}

export async function fanOutBlogPublicationDelivery(input: {
  envelope: CanonicalDomainEventEnvelope;
  deps?: BlogPublicationDeliveryDependencies;
}): Promise<BlogPublicationDeliveryFanOutResult> {
  const deps = input.deps ?? defaultDeps();
  const stats: BlogPublicationDeliveryFanOutResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skippedAlreadySent: 0,
    skippedIneligible: 0,
    skippedMaxAttempts: 0,
  };

  const parsed = parseBlogPostPublishedDeliveryPayload(input.envelope);
  if (!parsed) {
    console.error(
      `[blog-publication-delivery] invalid payload | eventId=${input.envelope.eventId}`,
    );
    return { ...stats, skippedReason: "invalid_payload" };
  }

  const post = await deps.findPostById(parsed.postId);
  if (!post || !isBlogPostPubliclyDeliverable(post)) {
    console.info(
      `[blog-publication-delivery] skip not deliverable | postId=${parsed.postId}`,
    );
    return { ...stats, skippedReason: "post_not_deliverable" };
  }

  const config = resolveEmailConfig();
  const base = config.publicSiteUrl.replace(/\/$/, "");
  const publicationUrl = `${base}/blog/${encodeURIComponent(post.slug)}`;
  const coverImageUrl = isSafeHttpsImageUrl(post.coverMedia?.mediaUrl)
    ? post.coverMedia!.mediaUrl
    : undefined;

  let afterSubscriberId: string | undefined;
  for (;;) {
    const batch = await deps.listEligibleBatch({
      afterSubscriberId,
      limit: BLOG_PUBLICATION_DELIVERY_BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }

    await mapPool(batch, BLOG_PUBLICATION_DELIVERY_CONCURRENCY, async (subscriber) => {
      await deliverToSubscriber({
        post,
        postId: parsed.postId,
        publicationUrl,
        coverImageUrl,
        deps,
        subscriber,
        stats,
      });
    });

    afterSubscriberId = batch[batch.length - 1]!.subscriberId;
    if (batch.length < BLOG_PUBLICATION_DELIVERY_BATCH_SIZE) {
      break;
    }
  }

  console.info(
    `[blog-publication-delivery] complete | postId=${parsed.postId} attempted=${stats.attempted} sent=${stats.sent} failed=${stats.failed} skippedSent=${stats.skippedAlreadySent} skippedIneligible=${stats.skippedIneligible}`,
  );

  return stats;
}
