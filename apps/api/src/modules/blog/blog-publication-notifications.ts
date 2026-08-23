/**
 * Editorial Review Pack 06 + Pack 13B/14B — Blog publication notifications.
 * Author decision notices + Admin review fan-out via member_notifications.
 */
import type { CivicNotificationEventType } from "@hu/types";

import {
  sendBlogPublicationStatusEmail,
  type BlogPublicationEmailStatus,
} from "../email/email.service.js";
import { listAuthUsersForAdmin } from "../auth/auth-user.repository.js";
import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import {
  createNotification,
  existsNotificationForRecipientEventAndRelatedEntity,
} from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

function publishingRecordUrl(postId: string): string {
  return `/workspace/publishing/${encodeURIComponent(postId)}`;
}

function editorialReviewUrl(postId: string): string {
  return `/workspace/editorial/${encodeURIComponent(postId)}`;
}

/**
 * Pack 14B — versioned review-cycle identity for Admin notification dedupe.
 * Resubmit after return uses a new submittedAt → new notification allowed.
 * Accidental double-submit of the same cycle is skipped.
 */
export function blogPublicationReviewNotificationEntityId(
  postId: string,
  submittedAt: string,
): string {
  return `${postId}|${submittedAt}`;
}

export function parseBlogPublicationReviewPostId(relatedEntityId: string): string {
  const separator = relatedEntityId.indexOf("|");
  return separator === -1 ? relatedEntityId : relatedEntityId.slice(0, separator);
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

async function resolveAuthorDisplayName(authorParticipantId: string): Promise<string> {
  const authUser = await findAuthUserByMemberId(authorParticipantId);
  if (!authUser) {
    return "An Author";
  }
  const profile = await findMemberProfileByUserId(authUser.userId);
  return (
    profile?.displayName?.trim() ||
    authUser.displayName?.trim() ||
    authUser.email ||
    "An Author"
  );
}

/**
 * Pack 14B — notify every active Administrator that a publication awaits review.
 * Idempotent per (admin, eventType, postId|submittedAt). Best-effort; never throws.
 */
export async function emitBlogPublicationAdminReviewNotifications(input: {
  authorParticipantId: string;
  postId: string;
  title: string;
  submittedAt: string;
}): Promise<{ deliveredCount: number; skippedExistingCount: number }> {
  try {
    const displayName = await resolveAuthorDisplayName(input.authorParticipantId);
    const template = getNotificationTemplate("blog_publication_review_requested");
    const safeTitle = input.title.trim() || "Untitled publication";
    const message = `${displayName} submitted “${safeTitle}” for review.`;
    const relatedEntityId = blogPublicationReviewNotificationEntityId(
      input.postId,
      input.submittedAt,
    );
    const relatedUrl = editorialReviewUrl(input.postId);

    const admins = await listAuthUsersForAdmin({
      role: "admin",
      status: "active",
      sort: "createdAt",
      order: "asc",
      limit: 100,
      offset: 0,
    });

    let deliveredCount = 0;
    let skippedExistingCount = 0;
    for (const admin of admins.items) {
      try {
        const alreadyExists = await existsNotificationForRecipientEventAndRelatedEntity({
          recipientUserId: admin.userId,
          eventType: "blog_publication_review_requested",
          relatedEntityType: "blog_post",
          relatedEntityId,
        });
        if (alreadyExists) {
          skippedExistingCount += 1;
          continue;
        }

        const profile = await findMemberProfileByUserId(admin.userId);
        await createNotification({
          recipientUserId: admin.userId,
          recipientProfileId: profile?.profileId ?? admin.userId,
          eventType: "blog_publication_review_requested",
          title: template.title,
          message,
          relatedEntityType: "blog_post",
          relatedEntityId,
          relatedUrl,
          priority: template.priority,
        });
        deliveredCount += 1;
      } catch {
        /* continue notifying remaining Admins */
      }
    }

    return { deliveredCount, skippedExistingCount };
  } catch {
    return { deliveredCount: 0, skippedExistingCount: 0 };
  }
}
