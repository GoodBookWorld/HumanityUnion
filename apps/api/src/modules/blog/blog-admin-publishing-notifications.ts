/**
 * Pack 13B — Author / Publication Admin block notifications via member_notifications.
 */
import type { CivicEntityType, CivicNotificationEventType } from "@hu/types";

import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

const AUTHORING_URL = "/workspace/authoring";
const PUBLISHING_URL = "/workspace/publishing";

async function notifyParticipant(input: {
  participantId: string;
  eventType: CivicNotificationEventType;
  relatedEntityType: CivicEntityType;
  relatedEntityId: string;
  relatedUrl: string;
  messageOverride?: string;
}): Promise<void> {
  try {
    const recipient = await resolveRecipientIdentity(input.participantId);
    if (!recipient) {
      return;
    }
    const template = getNotificationTemplate(input.eventType);
    await createNotification({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      eventType: input.eventType,
      title: template.title,
      message: input.messageOverride ?? template.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      relatedUrl: input.relatedUrl,
      priority: template.priority,
    });
  } catch {
    /* never block Admin moderation workflows */
  }
}

export async function emitBlogAuthorAccessBlockedNotification(input: {
  participantId: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_author_access_blocked",
    relatedEntityType: "blog_author_application",
    relatedEntityId: input.participantId,
    relatedUrl: AUTHORING_URL,
  });
}

export async function emitBlogAuthorAccessRestoredNotification(input: {
  participantId: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_author_access_restored",
    relatedEntityType: "blog_author_application",
    relatedEntityId: input.participantId,
    relatedUrl: PUBLISHING_URL,
  });
}

/** Pack 16G — Author notified when Admin enables Trusted Publishing. */
export async function emitBlogAuthorTrustedPublishingEnabledNotification(input: {
  participantId: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_author_trusted_publishing_enabled",
    relatedEntityType: "blog_author_application",
    relatedEntityId: input.participantId,
    relatedUrl: PUBLISHING_URL,
  });
}

/** Pack 16G — Author notified when Admin disables Trusted Publishing. */
export async function emitBlogAuthorTrustedPublishingDisabledNotification(input: {
  participantId: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_author_trusted_publishing_disabled",
    relatedEntityType: "blog_author_application",
    relatedEntityId: input.participantId,
    relatedUrl: PUBLISHING_URL,
  });
}

export async function emitBlogPublicationBlockedNotification(input: {
  participantId: string;
  postId: string;
  title: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_publication_blocked",
    relatedEntityType: "blog_post",
    relatedEntityId: input.postId,
    relatedUrl: `${PUBLISHING_URL}/${encodeURIComponent(input.postId)}`,
    messageOverride: `“${input.title}” is no longer publicly available.`,
  });
}

export async function emitBlogPublicationRestoredNotification(input: {
  participantId: string;
  postId: string;
  title: string;
}): Promise<void> {
  await notifyParticipant({
    participantId: input.participantId,
    eventType: "blog_publication_restored",
    relatedEntityType: "blog_post",
    relatedEntityId: input.postId,
    relatedUrl: `${PUBLISHING_URL}/${encodeURIComponent(input.postId)}`,
    messageOverride: `Visibility for “${input.title}” has been restored according to its publication status.`,
  });
}
