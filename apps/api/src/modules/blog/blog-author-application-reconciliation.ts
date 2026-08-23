/**
 * Pack 14A — recover legacy pending Author applications missing Admin review delivery.
 * Reconciliation never changes application status; notifications are idempotent.
 */
import type {
  AdminPendingAuthorApplicationItem,
  AdminPendingAuthorApplicationListResponse,
  AdminAuthorApplicationReconcileResult,
  BlogAuthorApplication,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId, listAuthUsersForAdmin } from "../auth/auth-user.repository.js";
import { findMemberById } from "../member/infrastructure/member.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { existsNotificationForRecipientEventAndRelatedEntity } from "../notifications/notification.service.js";
import { BlogConflictError, BlogNotFoundError, BlogValidationError } from "./blog.errors.js";
import { emitBlogAuthorApplicationAdminReviewNotifications } from "./blog-author-application-notifications.js";
import {
  findBlogAuthorApplicationById,
  listPendingBlogAuthorApplications,
  replaceBlogAuthorApplication,
} from "./persistence/blog.repository.js";

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

async function applicationHasAnyAdminReviewNotification(
  applicationId: string,
): Promise<boolean> {
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
      eventType: "blog_author_application_review_requested",
      relatedEntityType: "blog_author_application",
      relatedEntityId: applicationId,
    });
    if (exists) {
      return true;
    }
  }
  return false;
}

function isStructurallyInvalidApplication(application: BlogAuthorApplication): boolean {
  const motivation = application.motivation?.trim() ?? "";
  const topics = application.topics?.trim() ?? "";
  if (motivation.length < 10 && topics.length < 10) {
    return true;
  }
  if (application.agreedToStandards !== true) {
    return true;
  }
  return false;
}

async function toPendingQueueItem(
  application: BlogAuthorApplication,
): Promise<AdminPendingAuthorApplicationItem> {
  const authUser = await findAuthUserByMemberId(application.participantId);
  const profile = authUser ? await findMemberProfileByUserId(authUser.userId) : undefined;
  let uniqueName: string | undefined;
  try {
    const member = await findMemberById(application.participantId);
    uniqueName = member?.uniqueName?.trim() || undefined;
  } catch {
    // Member aggregate optional in some test paths.
  }
  const displayName =
    profile?.displayName?.trim() ||
    authUser?.displayName?.trim() ||
    authUser?.email ||
    "Participant";
  const hasAdminReviewNotification = await applicationHasAnyAdminReviewNotification(
    application.applicationId,
  );
  const structurallyInvalid = isStructurallyInvalidApplication(application);

  return {
    applicationId: application.applicationId,
    participantId: application.participantId,
    displayName,
    ...(uniqueName ? { uniqueName } : {}),
    email: authUser?.email ?? "",
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    ...(uniqueName
      ? { profileHref: `/participation/${encodeURIComponent(uniqueName)}` }
      : {}),
    status: application.status,
    submittedAt: application.createdAt,
    updatedAt: application.updatedAt,
    motivationPreview: (application.motivation ?? "").slice(0, 160),
    hasAdminReviewNotification,
    structurallyInvalid,
  };
}

/** Pack 14A — Admin Pending Author Applications queue (canonical review authority). */
export async function listAdminPendingAuthorApplications(input: {
  actorUserId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPendingAuthorApplicationListResponse> {
  await assertAdminActor(input.actorUserId);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const { items, total } = await listPendingBlogAuthorApplications({ limit, offset });
  const applications = await Promise.all(items.map((row) => toPendingQueueItem(row)));
  return { applications, total, limit, offset };
}

/**
 * Pack 14A — idempotent reconciliation for stuck pending applications.
 * Does not change application status or fields. Creates missing Admin review notifications only.
 */
export async function reconcilePendingAuthorApplications(input?: {
  actorUserId?: string;
}): Promise<AdminAuthorApplicationReconcileResult> {
  if (input?.actorUserId) {
    await assertAdminActor(input.actorUserId);
  }

  const { items } = await listPendingBlogAuthorApplications({ limit: 100, offset: 0 });
  let scannedCount = 0;
  let notifiedApplicationCount = 0;
  let notificationsCreated = 0;
  let skippedAlreadyNotified = 0;
  let skippedInvalid = 0;
  const recoveredApplicationIds: string[] = [];

  for (const application of items) {
    scannedCount += 1;
    if (isStructurallyInvalidApplication(application)) {
      skippedInvalid += 1;
      continue;
    }

    const authUser = await findAuthUserByMemberId(application.participantId);
    if (!authUser) {
      skippedInvalid += 1;
      continue;
    }

    const result = await emitBlogAuthorApplicationAdminReviewNotifications({
      applicantParticipantId: application.participantId,
      applicationId: application.applicationId,
    });

    notificationsCreated += result.deliveredCount;
    skippedAlreadyNotified += result.skippedExistingCount;
    if (result.deliveredCount > 0) {
      notifiedApplicationCount += 1;
      recoveredApplicationIds.push(application.applicationId);
    }
  }

  if (input?.actorUserId) {
    const admin = await findAuthUserById(input.actorUserId);
    if (admin) {
      await record({
        actorParticipantId: admin.memberId,
        action: "blog.author_application.reconcile",
        targetType: "blog_author_application",
        targetId: "pending-batch",
        afterSummary: `scanned=${scannedCount};notifiedApps=${notifiedApplicationCount};created=${notificationsCreated}`,
      }).catch(() => undefined);
    }
  }

  return {
    scannedCount,
    notifiedApplicationCount,
    notificationsCreated,
    skippedAlreadyNotified,
    skippedInvalid,
    recoveredApplicationIds,
  };
}

/**
 * Pack 14A — controlled recovery for structurally invalid legacy applications.
 * Does NOT delete. Sets changes_requested so Participant may revise/resubmit.
 */
export async function markInvalidLegacyAuthorApplicationForResubmit(input: {
  actorUserId: string;
  applicationId: string;
  reason?: string;
}): Promise<BlogAuthorApplication> {
  await assertAdminActor(input.actorUserId);
  const existing = await findBlogAuthorApplicationById(input.applicationId);
  if (!existing) {
    throw new BlogNotFoundError("Blog Author application not found.");
  }
  if (existing.status === "approved" || existing.status === "declined") {
    throw new BlogConflictError("Decided applications cannot be reset for resubmit.");
  }
  if (!isStructurallyInvalidApplication(existing)) {
    throw new BlogValidationError(
      "Only structurally invalid applications may use recovery reset. Valid pending applications should be Invited or Refused.",
    );
  }

  const reason =
    input.reason?.trim() ||
    "Your earlier Author application could not be completed in review because required details were incomplete. Please update and resubmit.";
  if (reason.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }

  const now = new Date().toISOString();
  const updated: BlogAuthorApplication = {
    ...existing,
    status: "changes_requested",
    reviewNote: reason,
    updatedAt: now,
  };
  await replaceBlogAuthorApplication(updated);

  const admin = await findAuthUserById(input.actorUserId);
  if (admin) {
    await record({
      actorParticipantId: admin.memberId,
      action: "blog.author_application.recovery_reset",
      targetType: "blog_author_application",
      targetId: existing.applicationId,
      reason,
      beforeSummary: `status=${existing.status}`,
      afterSummary: "status=changes_requested",
    }).catch(() => undefined);
  }

  return updated;
}

let startupReconcileStarted = false;

/** Pack 14A — one-shot boot reconcile; safe to call repeatedly (notification dedupe). */
export function startAuthorApplicationReconciliationOnce(): void {
  if (startupReconcileStarted) {
    return;
  }
  startupReconcileStarted = true;
  void reconcilePendingAuthorApplications().catch(() => undefined);
}
