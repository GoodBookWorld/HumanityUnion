/**
 * Pack 14B — Admin Pending Publication Review queue + notification reconciliation.
 * Queue is canonical review authority; notifications are attention only.
 */
import type {
  AdminPendingPublicationReviewItem,
  AdminPendingPublicationReviewListResponse,
  AdminPublicationReviewReconcileResult,
  BlogPost,
} from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { record } from "../administration/audit.service.js";
import { findAuthUserById, listAuthUsersForAdmin } from "../auth/auth-user.repository.js";
import { existsNotificationForRecipientEventAndRelatedEntity } from "../notifications/notification.service.js";
import {
  blogPublicationReviewNotificationEntityId,
  emitBlogPublicationAdminReviewNotifications,
} from "./blog-publication-notifications.js";
import { listBlogPostsForEditorialQueue } from "./persistence/blog.repository.js";

async function assertAdminActor(actorUserId: string): Promise<{ participantId: string }> {
  const actor = await findAuthUserById(actorUserId);
  if (!actor) {
    throw new AdministrationUnauthorizedError();
  }
  if (actor.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator role is required.");
  }
  return { participantId: actor.memberId };
}

function categoryName(categoryId: BlogPost["categoryId"]): string {
  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}

async function publicationHasAdminReviewNotification(post: BlogPost): Promise<boolean> {
  const submittedAt = post.submittedAt;
  if (!submittedAt) {
    return false;
  }
  const relatedEntityId = blogPublicationReviewNotificationEntityId(post.postId, submittedAt);
  const admins = await listAuthUsersForAdmin({
    role: "admin",
    status: "active",
    sort: "createdAt",
    order: "asc",
    limit: 100,
    offset: 0,
  });
  for (const admin of admins.items) {
    const exists = await existsNotificationForRecipientEventAndRelatedEntity({
      recipientUserId: admin.userId,
      eventType: "blog_publication_review_requested",
      relatedEntityType: "blog_post",
      relatedEntityId,
    });
    if (exists) {
      return true;
    }
  }
  return false;
}

async function toPendingReviewItem(post: BlogPost): Promise<AdminPendingPublicationReviewItem> {
  const hasAdminReviewNotification = await publicationHasAdminReviewNotification(post);
  return {
    postId: post.postId,
    title: post.title,
    slug: post.slug,
    authorParticipantId: post.authorParticipantId,
    authorDisplayName: post.authorDisplayNameSnapshot,
    categoryId: post.categoryId,
    categoryName: categoryName(post.categoryId),
    status: post.status,
    reviewStatus: post.review.reviewStatus,
    submittedAt: post.submittedAt ?? post.updatedAt,
    updatedAt: post.updatedAt,
    ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
    administrativelyBlocked: post.administrativelyBlocked === true,
    hasAdminReviewNotification,
    editorialHref: `/workspace/editorial/${encodeURIComponent(post.postId)}`,
    publishingHref: `/workspace/publishing/${encodeURIComponent(post.postId)}`,
  };
}

/** Pack 14B — pending publications awaiting editorial review (notification-independent). */
export async function listAdminPendingPublicationReviews(input: {
  actorUserId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPendingPublicationReviewListResponse> {
  await assertAdminActor(input.actorUserId);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const listed = await listBlogPostsForEditorialQueue({
    status: "submitted_for_review",
    limit,
    offset,
  });
  const publications = await Promise.all(listed.items.map((post) => toPendingReviewItem(post)));
  return { publications, total: listed.total, limit, offset };
}

/**
 * Pack 14B — idempotent reconcile for submitted publications missing Admin review notifications.
 * Does not change publication status or dates.
 */
export async function reconcilePendingPublicationReviews(input?: {
  actorUserId?: string;
}): Promise<AdminPublicationReviewReconcileResult> {
  if (input?.actorUserId) {
    await assertAdminActor(input.actorUserId);
  }

  const listed = await listBlogPostsForEditorialQueue({
    status: "submitted_for_review",
    limit: 100,
    offset: 0,
  });

  let scannedCount = 0;
  let notifiedPublicationCount = 0;
  let notificationsCreated = 0;
  let skippedAlreadyNotified = 0;
  const recoveredPostIds: string[] = [];

  for (const post of listed.items) {
    scannedCount += 1;
    if (!post.submittedAt) {
      continue;
    }
    const result = await emitBlogPublicationAdminReviewNotifications({
      authorParticipantId: post.authorParticipantId,
      postId: post.postId,
      title: post.title,
      submittedAt: post.submittedAt,
    });
    notificationsCreated += result.deliveredCount;
    skippedAlreadyNotified += result.skippedExistingCount;
    if (result.deliveredCount > 0) {
      notifiedPublicationCount += 1;
      recoveredPostIds.push(post.postId);
    }
  }

  if (input?.actorUserId) {
    const admin = await findAuthUserById(input.actorUserId);
    if (admin) {
      await record({
        actorParticipantId: admin.memberId,
        action: "blog.publication_review.reconcile",
        targetType: "blog_post",
        targetId: "pending-review-batch",
        afterSummary: `scanned=${scannedCount};notifiedPubs=${notifiedPublicationCount};created=${notificationsCreated}`,
      }).catch(() => undefined);
    }
  }

  return {
    scannedCount,
    notifiedPublicationCount,
    notificationsCreated,
    skippedAlreadyNotified,
    recoveredPostIds,
  };
}

let startupReconcileStarted = false;

/** Pack 14B — one-shot boot reconcile; safe via notification dedupe. */
export function startPublicationReviewReconciliationOnce(): void {
  if (startupReconcileStarted) {
    return;
  }
  startupReconcileStarted = true;
  void reconcilePendingPublicationReviews().catch(() => undefined);
}
