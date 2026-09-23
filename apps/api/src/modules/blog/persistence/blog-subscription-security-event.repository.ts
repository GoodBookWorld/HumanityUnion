/**
 * EMAIL SECURITY 02B — privacy-safe durable security events for Blog subscription.
 */
import { randomUUID } from "node:crypto";

import type {
  BlogSubscriptionAbuseBlockReason,
  BlogSubscriptionSecurityOutcome,
} from "../blog-subscription-abuse-policy.js";
import { BLOG_SUBSCRIPTION_SECURITY_EVENT_TTL_MS } from "../blog-subscription-abuse-policy.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { isDeployedPlatformRequiringRealEmail } from "../../email/email-safety-guards.js";

export interface BlogSubscriptionSecurityEvent {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly expiresAt: Date;
  readonly action: "blog_subscribe";
  readonly outcome: BlogSubscriptionSecurityOutcome;
  readonly reason: BlogSubscriptionAbuseBlockReason | "ok_send" | "ok_no_send";
  readonly recipientHash: string;
  readonly sourceIpHash: string;
  readonly correlationId?: string;
  readonly emailAuditId?: string;
  readonly template?: string;
}

const memoryEvents: BlogSubscriptionSecurityEvent[] = [];

function useMemoryStore(): boolean {
  if (process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true") {
    return true;
  }
  if (isMongoConfigured()) {
    return false;
  }
  return !isDeployedPlatformRequiringRealEmail();
}

async function ensureReady(): Promise<void> {
  if (useMemoryStore()) {
    return;
  }
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<BlogSubscriptionSecurityEvent & { _id?: string }>(
    MONGO_COLLECTIONS.blogSubscriptionSecurityEvents,
  );
}

export function resetBlogSubscriptionSecurityEventsForTests(): void {
  memoryEvents.length = 0;
}

export function listBlogSubscriptionSecurityEventsForTests(): readonly BlogSubscriptionSecurityEvent[] {
  return [...memoryEvents];
}

export async function recordBlogSubscriptionSecurityEvent(input: {
  outcome: BlogSubscriptionSecurityOutcome;
  reason: BlogSubscriptionAbuseBlockReason | "ok_send" | "ok_no_send";
  recipientHash: string;
  sourceIpHash: string;
  correlationId?: string;
  emailAuditId?: string;
  template?: string;
}): Promise<BlogSubscriptionSecurityEvent | null> {
  const occurredAt = new Date().toISOString();
  const event: BlogSubscriptionSecurityEvent = {
    eventId: randomUUID(),
    occurredAt,
    expiresAt: new Date(Date.now() + BLOG_SUBSCRIPTION_SECURITY_EVENT_TTL_MS),
    action: "blog_subscribe",
    outcome: input.outcome,
    reason: input.reason,
    recipientHash: input.recipientHash,
    sourceIpHash: input.sourceIpHash,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.emailAuditId ? { emailAuditId: input.emailAuditId } : {}),
    ...(input.template ? { template: input.template } : {}),
  };

  try {
    await ensureReady();
    if (useMemoryStore() || !isMongoConfigured()) {
      memoryEvents.push(event);
      return event;
    }
    await collection().insertOne(event);
    return event;
  } catch {
    // Audit must never block or reveal — best-effort only.
    console.error("[blog-subscription-security] failed to persist security event");
    return null;
  }
}
