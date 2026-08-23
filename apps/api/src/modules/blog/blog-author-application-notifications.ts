/**
 * Pack 04 + Pack 13A — Blog Author application notifications.
 * Applicant confirmation + Admin review fan-out via member_notifications.
 */
import type { CivicNotificationEventType } from "@hu/types";

import {
  sendBlogAuthorApplicationStatusEmail,
  type BlogAuthorApplicationEmailStatus,
} from "../email/email.service.js";
import { listAuthUsersForAdmin } from "../auth/auth-user.repository.js";
import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

const AUTHORING_URL = "/workspace/authoring";
const PUBLISHING_URL = "/workspace/publishing";
/** Deep-link hint for Notification Center; Pack 13A opens review modal instead of navigating. */
const ADMIN_REVIEW_URL = "/notifications";

async function notifyApplicant(input: {
  participantId: string;
  applicationId: string;
  eventType:
    | "blog_author_application_submitted"
    | "blog_author_application_approved"
    | "blog_author_application_changes_requested"
    | "blog_author_application_declined";
  emailStatus?: BlogAuthorApplicationEmailStatus;
  relatedUrl?: string;
  messageOverride?: string;
}): Promise<boolean> {
  try {
    const recipient = await resolveRecipientIdentity(input.participantId);
    if (!recipient) {
      return false;
    }

    const template = getNotificationTemplate(input.eventType as CivicNotificationEventType);

    await createNotification({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      eventType: input.eventType,
      title: template.title,
      message: input.messageOverride ?? template.message,
      relatedEntityType: "blog_author_application",
      relatedEntityId: input.applicationId,
      relatedUrl: input.relatedUrl ?? AUTHORING_URL,
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

    return true;
  } catch {
    return false;
  }
}

async function resolveApplicantDisplayName(participantId: string): Promise<string> {
  const authUser = await findAuthUserByMemberId(participantId);
  if (!authUser) {
    return "A Participant";
  }
  const profile = await findMemberProfileByUserId(authUser.userId);
  return (
    profile?.displayName?.trim() ||
    authUser.displayName?.trim() ||
    authUser.email ||
    "A Participant"
  );
}

/**
 * Pack 13A — notify every active Administrator account.
 * Best-effort; never throws to callers.
 */
export async function emitBlogAuthorApplicationAdminReviewNotifications(input: {
  applicantParticipantId: string;
  applicationId: string;
}): Promise<{ deliveredCount: number }> {
  try {
    const displayName = await resolveApplicantDisplayName(input.applicantParticipantId);
    const template = getNotificationTemplate("blog_author_application_review_requested");
    const message = `${displayName} submitted an Author application.`;

    const admins = await listAuthUsersForAdmin({
      role: "admin",
      status: "active",
      sort: "createdAt",
      order: "asc",
      limit: 100,
      offset: 0,
    });

    let deliveredCount = 0;
    for (const admin of admins.items) {
      try {
        const profile = await findMemberProfileByUserId(admin.userId);
        await createNotification({
          recipientUserId: admin.userId,
          recipientProfileId: profile?.profileId ?? admin.userId,
          eventType: "blog_author_application_review_requested",
          title: template.title,
          message,
          relatedEntityType: "blog_author_application",
          relatedEntityId: input.applicationId,
          relatedUrl: ADMIN_REVIEW_URL,
          priority: template.priority,
        });
        deliveredCount += 1;
      } catch {
        /* continue notifying remaining Admins */
      }
    }

    return { deliveredCount };
  } catch {
    return { deliveredCount: 0 };
  }
}

export async function emitBlogAuthorApplicationSubmittedNotification(input: {
  participantId: string;
  applicationId: string;
}): Promise<void> {
  await notifyApplicant({ ...input, eventType: "blog_author_application_submitted" }).catch(() => {
    /* never block Author Access workflows */
  });
  await emitBlogAuthorApplicationAdminReviewNotifications({
    applicantParticipantId: input.participantId,
    applicationId: input.applicationId,
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
    relatedUrl: PUBLISHING_URL,
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
  reviewNote?: string;
}): Promise<void> {
  const template = getNotificationTemplate("blog_author_application_declined");
  const message = input.reviewNote?.trim()
    ? `${template.message} ${input.reviewNote.trim()}`
    : template.message;

  await notifyApplicant({
    participantId: input.participantId,
    applicationId: input.applicationId,
    eventType: "blog_author_application_declined",
    emailStatus: "declined",
    messageOverride: message,
  }).catch(() => {
    /* never block Author Access workflows */
  });
}
