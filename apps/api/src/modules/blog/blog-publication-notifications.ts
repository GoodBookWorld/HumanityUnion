import type { CivicNotificationEventType } from "@hu/types";

import {
  sendBlogPublicationStatusEmail,
  type BlogPublicationEmailStatus,
} from "../email/email.service.js";
import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

function publishingRecordUrl(postId: string): string {
  return `/workspace/publishing/${encodeURIComponent(postId)}`;
}

async function notifyAuthor(input: {
  authorParticipantId: string;
  postId: string;
  eventType: "blog_post_changes_requested" | "blog_post_published" | "blog_post_declined";
  emailStatus: BlogPublicationEmailStatus;
}): Promise<void> {
  const recipient = await resolveRecipientIdentity(input.authorParticipantId);
  if (!recipient) {
    return;
  }

  const template = getNotificationTemplate(input.eventType as CivicNotificationEventType);
  const relatedUrl = publishingRecordUrl(input.postId);

  await createNotification({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    eventType: input.eventType,
    title: template.title,
    message: template.message,
    relatedEntityType: "blog_post",
    relatedEntityId: input.postId,
    relatedUrl,
    priority: template.priority,
  });

  await sendBlogPublicationStatusEmail({
    participantId: input.authorParticipantId,
    status: input.emailStatus,
    postId: input.postId,
  }).catch(() => {
    /* email must never block editorial workflows */
  });
}

export async function emitBlogPostChangesRequestedNotification(input: {
  authorParticipantId: string;
  postId: string;
}): Promise<void> {
  await notifyAuthor({
    ...input,
    eventType: "blog_post_changes_requested",
    emailStatus: "changes_requested",
  }).catch(() => {
    /* never block editorial workflows */
  });
}

export async function emitBlogPostPublishedNotification(input: {
  authorParticipantId: string;
  postId: string;
}): Promise<void> {
  await notifyAuthor({
    ...input,
    eventType: "blog_post_published",
    emailStatus: "published",
  }).catch(() => {
    /* never block editorial workflows */
  });
}

export async function emitBlogPostDeclinedNotification(input: {
  authorParticipantId: string;
  postId: string;
}): Promise<void> {
  await notifyAuthor({
    ...input,
    eventType: "blog_post_declined",
    emailStatus: "declined",
  }).catch(() => {
    /* never block editorial workflows */
  });
}
