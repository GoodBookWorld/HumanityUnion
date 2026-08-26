/**
 * Pack 22E.1 — BlogSubscriptionConfirmed domain event.
 */
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";

export const BLOG_SUBSCRIBER_AGGREGATE_TYPE = "BlogSubscriber" as const;

export interface BlogSubscriptionConfirmedPayload extends Record<string, unknown> {
  subscriberId: string;
  /** Safe Admin display label (emailDisplay or linked name) — never tokens. */
  displayLabel: string;
  confirmedAt: string;
}

export function buildBlogSubscriptionConfirmedEventId(
  subscriberId: string,
  confirmedAt: string,
): string {
  return `blog-subscription-confirmed:${subscriberId}:${confirmedAt}`;
}

export function createBlogSubscriptionConfirmedEvent(input: {
  subscriberId: string;
  displayLabel: string;
  confirmedAt: string;
  actorId?: string | null;
}): DomainEvent<BlogSubscriptionConfirmedPayload> {
  return createDomainEvent({
    eventId: buildBlogSubscriptionConfirmedEventId(input.subscriberId, input.confirmedAt),
    eventName: CATALOGUE_EVENTS.blogSubscriptionConfirmed,
    aggregateType: BLOG_SUBSCRIBER_AGGREGATE_TYPE,
    aggregateId: input.subscriberId,
    actorId: input.actorId ?? null,
    occurredAt: input.confirmedAt,
    payload: {
      subscriberId: input.subscriberId,
      displayLabel: input.displayLabel,
      confirmedAt: input.confirmedAt,
    },
  });
}

/**
 * Enqueue only when Mongo/outbox is available. Confirmation must not fail in memory-only tests.
 */
export async function emitBlogSubscriptionConfirmed(input: {
  subscriberId: string;
  displayLabel: string;
  confirmedAt: string;
  actorId?: string | null;
}): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await enqueueDomainEvent(createBlogSubscriptionConfirmedEvent(input));
}
