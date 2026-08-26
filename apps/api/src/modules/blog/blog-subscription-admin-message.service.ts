/**
 * Pack 21E — queue Admin selected-subscriber Blog message (durable outbox).
 */
import { randomUUID } from "node:crypto";

import type {
  AdminBlogSubscriberMessageQueueResponse,
  BlogAdminSubscriberMessageRecord,
} from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import {
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { assertBlogSubscriberAdminActor } from "./blog-subscription-admin.service.js";
import {
  sanitizeAdminSubscriberIdList,
  sanitizeAdminSubscriberMessageBody,
  sanitizeAdminSubscriberMessageSubject,
  sanitizeOptionalAdminMessageCta,
} from "./blog-subscription-admin-message-validation.js";
import { insertBlogAdminSubscriberMessage } from "./persistence/blog-admin-subscriber-message.repository.js";

export async function emitBlogAdminSubscriberMessageQueued(input: {
  adminMessageId: string;
  createdByParticipantId: string;
  selectedRecipientCount: number;
}): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued,
      aggregateType: "BlogAdminSubscriberMessage",
      aggregateId: input.adminMessageId,
      actorId: input.createdByParticipantId,
      payload: {
        adminMessageId: input.adminMessageId,
        createdByParticipantId: input.createdByParticipantId,
        selectedRecipientCount: input.selectedRecipientCount,
      },
    }),
  );
}

export async function queueAdminBlogSubscriberMessage(input: {
  actorUserId: string;
  body: unknown;
  /** Test seam — defaults to durable outbox enqueue. */
  enqueue?: (input: {
    adminMessageId: string;
    createdByParticipantId: string;
    selectedRecipientCount: number;
  }) => Promise<void>;
}): Promise<AdminBlogSubscriberMessageQueueResponse> {
  const admin = await assertBlogSubscriberAdminActor(input.actorUserId);
  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Message body is required.");
  }
  const body = input.body as Record<string, unknown>;

  let subject: string;
  let message: string;
  let subscriberIds: string[];
  let cta: { ctaLabel?: string; ctaUrl?: string };
  try {
    subject = sanitizeAdminSubscriberMessageSubject(body.subject);
    message = sanitizeAdminSubscriberMessageBody(body.message);
    subscriberIds = sanitizeAdminSubscriberIdList(body.subscriberIds);
    cta = sanitizeOptionalAdminMessageCta({
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
    });
  } catch (error) {
    throw new AdministrationValidationError(
      error instanceof Error ? error.message : "Invalid message payload.",
    );
  }

  const now = new Date().toISOString();
  const record: BlogAdminSubscriberMessageRecord = {
    adminMessageId: randomUUID(),
    subject,
    message,
    selectedSubscriberIds: subscriberIds,
    createdByParticipantId: admin.participantId,
    createdAt: now,
    ...(cta.ctaLabel && cta.ctaUrl
      ? { ctaLabel: cta.ctaLabel, ctaUrl: cta.ctaUrl }
      : {}),
  };

  await insertBlogAdminSubscriberMessage(record);
  const enqueue = input.enqueue ?? emitBlogAdminSubscriberMessageQueued;
  await enqueue({
    adminMessageId: record.adminMessageId,
    createdByParticipantId: admin.participantId,
    selectedRecipientCount: subscriberIds.length,
  });

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.subscriber_message.queue",
    targetType: "blog_admin_subscriber_message",
    targetId: record.adminMessageId,
    scope: { scopeType: "blog", scopeId: "subscribers" },
    afterSummary: `adminMessageId=${record.adminMessageId};selectedRecipientCount=${subscriberIds.length};subjectLength=${subject.length}`,
  });

  return {
    queued: true,
    adminMessageId: record.adminMessageId,
    selectedRecipientCount: subscriberIds.length,
    status: "queued",
    message: `Message queued for ${subscriberIds.length} selected subscribers.`,
  };
}
