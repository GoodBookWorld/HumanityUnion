import type { CivicNotificationEventType } from "@hu/types";

import {
  sendBlogAuthorApplicationStatusEmail,
  type BlogAuthorApplicationEmailStatus,
} from "../email/email.service.js";
import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

const AUTHORING_URL = "/workspace/authoring";

async function notifyApplicant(input: {
  participantId: string;
  applicationId: string;
  eventType:
    | "blog_author_application_submitted"
    | "blog_author_application_approved"
    | "blog_author_application_changes_requested"
    | "blog_author_application_declined";
  emailStatus?: BlogAuthorApplicationEmailStatus;
}): Promise<void> {
  const recipient = await resolveRecipientIdentity(input.participantId);
  if (!recipient) {
    return;
  }

  const template = getNotificationTemplate(input.eventType as CivicNotificationEventType);

  await createNotification({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    eventType: input.eventType,
    title: template.title,
    message: template.message,
    relatedEntityType: "blog_author_application",
    relatedEntityId: input.applicationId,
    relatedUrl: AUTHORING_URL,
    priority: template.priority,
  });

  if (input.emailStatus) {
    await sendBlogAuthorApplicationStatusEmail({
      participantId: input.participantId,
      status: input.emailStatus,
    }).catch(() => {
      /* email must never block Author Access workflows */
    });
  }
}

export async function emitBlogAuthorApplicationSubmittedNotification(input: {
  participantId: string;
  applicationId: string;
}): Promise<void> {
  await notifyApplicant({ ...input, eventType: "blog_author_application_submitted" }).catch(() => {
    /* never block Author Access workflows */
  });
}

export async function emitBlogAuthorApplicationApprovedNotification(input: {
  participantId: string;
  applicationId: string;
}): Promise<void> {
  await notifyApplicant({
    ...input,
    eventType: "blog_author_application_approved",
    emailStatus: "approved",
  }).catch(() => {
    /* never block Author Access workflows */
  });
}

export async function emitBlogAuthorApplicationChangesRequestedNotification(input: {
  participantId: string;
  applicationId: string;
}): Promise<void> {
  await notifyApplicant({
    ...input,
    eventType: "blog_author_application_changes_requested",
    emailStatus: "changes_requested",
  }).catch(() => {
    /* never block Author Access workflows */
  });
}

export async function emitBlogAuthorApplicationDeclinedNotification(input: {
  participantId: string;
  applicationId: string;
}): Promise<void> {
  await notifyApplicant({
    ...input,
    eventType: "blog_author_application_declined",
    emailStatus: "declined",
  }).catch(() => {
    /* never block Author Access workflows */
  });
}
