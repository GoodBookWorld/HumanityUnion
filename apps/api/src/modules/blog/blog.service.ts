import { randomUUID } from "node:crypto";

import type {
  AuthRole,
  BlogAuthorApplication,
  BlogAuthorApplicationStatus,
  BlogAuthoringAccessState,
  AdminAuthorApplicationReview,
  BlogAuthorWorkspacePost,
  BlogAuthorWorkspacePostListResponse,
  BlogCapability,
  BlogCapabilityGrant,
  BlogCategoryId,
  BlogEditorialQueueResponse,
  BlogEditorialReviewDetail,
  BlogPost,
  BlogPostStatus,
  LifecycleSafetyDecision,
  PublicBlogPostDetail,
  PublicBlogAuthorDirectoryResponse,
  PublicBlogPostListResponse,
} from "@hu/types";
import { BLOG_POST_STATUSES } from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberById } from "../member/infrastructure/member.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { evaluateLifecycleSafety } from "../lifecycle-safety/lifecycle-safety.service.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import { scheduleContentTranslationWarmAfterMutation } from "../language/content-translation-warm-enqueue.js";
import { blogHtmlToPlainText } from "./blog-content-sanitize.js";
import {
  appendEditorialHistory,
  assertExpectedUpdatedAt,
  buildEditorialHistoryEntry,
  requireReviewNote,
} from "./blog-editorial-history.js";
import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogNotFoundError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "./blog.errors.js";
import {
  emitBlogAuthorCapabilityGranted,
  emitBlogPostArchived,
  emitBlogPostChangesRequested,
  emitBlogPostEditoriallyDeclined,
  emitBlogPostPublished,
  emitBlogPostSubmittedForReview,
} from "./blog.events.js";
import {
  emitBlogAuthorApplicationApprovedNotification,
  emitBlogAuthorApplicationChangesRequestedNotification,
  emitBlogAuthorApplicationDeclinedNotification,
  emitBlogAuthorApplicationSubmittedNotification,
} from "./blog-author-application-notifications.js";
import {
  emitBlogPostChangesRequestedNotification,
  emitBlogPostDeclinedNotification,
  emitBlogPostPublishedNotification,
  emitBlogPublicationAdminReviewNotifications,
} from "./blog-publication-notifications.js";
import { enqueueBlogSocialDistributionBestEffort } from "./blog-social-distribution.js";
import { gateBlogPublicationOptimizationAgainstPlatformAccounts } from "./blog-seo.js";
import {
  canArchiveAny,
  canCreateBlogDraft,
  canDirectPublish,
  canEditOthersDrafts,
  canEditorialPublish,
  canManageAuthorGrants,
  canRestoreArchived,
  canReviewAuthorApplications,
  actorMayBypassManualReview,
  resolveBlogCapabilities,
  resolvePublishWithoutManualReview,
} from "./blog-permissions.js";
import { resolveBlogPublicAuthor } from "./blog-author-identity.js";
import { ensureBlogCategoriesSeeded, listBlogCategories } from "./blog-categories.js";
import { slugifyBlogTitle, withSlugCollisionSuffix } from "./blog-slug.js";
import { assertBlogStatusTransition } from "./blog-status-transitions.js";
import {
  assertNoInternalBlogFields,
  toBlogAuthorWorkspacePost,
  toBlogAuthorWorkspacePostSummary,
  toBlogPreviewProjection,
  toPublicBlogPostDetail,
  toPublicBlogPostListItem,
} from "./blog.projection.js";
import {
  requirePublishableContent,
  validateBlogAuthorApplicationInput,
  validateCreateBlogDraftInput,
  validateUpdateBlogDraftInput,
} from "./blog.validators.js";
import {
  isPublicationDue,
  publicationDateOnlyToIso,
} from "./blog-publication-date.js";
import {
  blogSlugExists,
  findActiveBlogAuthorApplication,
  findBlogAuthorApplicationById,
  findBlogCapabilityGrant,
  findBlogPostById,
  findBlogPostBySlug,
  findLatestBlogAuthorApplication,
  insertBlogAuthorApplication,
  insertBlogPost,
  listBlogPostsByAuthor,
  listBlogPostsForEditorialQueue,
  listDueScheduledBlogPosts,
  listLatestPublicBlogPostsByAuthor,
  listPublishedBlogPosts,
  listPublishedBlogPostsForSearch,
  aggregatePublishedBlogPostCountsByCategory,
  replaceBlogAuthorApplication,
  replaceBlogPost,
  upsertBlogCapabilityGrant,
} from "./persistence/blog.repository.js";
import { isBlogAuthorAdministrativelyBlocked } from "./admin-publishing.service.js";

export { listBlogCategories, listPublishedBlogPostsForSearch };

const AUTHOR_BLOCKED_MESSAGE =
  "Your Author access has been blocked. Please contact the administrator.";

/**
 * Pack 13B — Author soft-block denies Author publishing mutations.
 * Editors/Administrators retain editorial mutation paths.
 */
async function assertAuthorPublishingAllowed(input: {
  actorParticipantId: string;
  role?: AuthRole;
  capabilities: ReadonlySet<BlogCapability>;
}): Promise<void> {
  if (input.capabilities.has("editor") || input.capabilities.has("administrator")) {
    return;
  }
  if (await isBlogAuthorAdministrativelyBlocked(input.actorParticipantId)) {
    throw new BlogAccessDeniedError(AUTHOR_BLOCKED_MESSAGE);
  }
}

/**
 * Publishing Workspace Pack 05 — list posts the signed-in Author may manage.
 * Ordinary Authors see only their own posts. Editors may list another Author's
 * posts only when `authorParticipantId` is supplied (not used by Pack 05 UI).
 */
export async function listOwnBlogWorkspacePosts(input: {
  actorParticipantId: string;
  role?: AuthRole;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<BlogAuthorWorkspacePostListResponse> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canCreateBlogDraft(capabilities)) {
    throw new BlogAccessDeniedError("Author capability is required to open Publishing.");
  }

  let status: BlogPostStatus | undefined;
  if (input.status !== undefined && input.status !== "" && input.status !== "all") {
    if (!(BLOG_POST_STATUSES as readonly string[]).includes(input.status)) {
      throw new BlogValidationError(
        "status must be one of: draft, submitted_for_review, scheduled, published, archived.",
      );
    }
    status = input.status as BlogPostStatus;
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const result = await listBlogPostsByAuthor({
    authorParticipantId: input.actorParticipantId,
    status,
    limit,
    offset,
    sortByPublicationDate: true,
  });

  return {
    items: result.items.map(toBlogAuthorWorkspacePostSummary),
    total: result.total,
    limit,
    offset,
  };
}

async function allocateUniqueSlug(title: string, excludePostId?: string): Promise<string> {
  const base = slugifyBlogTitle(title);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = withSlugCollisionSuffix(base, attempt);
    if (!(await blogSlugExists(candidate, excludePostId))) {
      return candidate;
    }
  }

  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function evaluateBlogSafety(input: {
  actorParticipantId: string;
  title: string;
  excerpt: string;
  content: string;
}): Promise<LifecycleSafetyDecision> {
  const text = [input.title, input.excerpt, blogHtmlToPlainText(input.content)]
    .filter(Boolean)
    .join("\n\n");

  return evaluateLifecycleSafety({
    surfaceId: "blog_post",
    initiativeId: null,
    actorParticipantId: input.actorParticipantId,
    text,
    fieldName: "blog_post",
  });
}

function applySafetyGate(decision: LifecycleSafetyDecision, mode: "store" | "publish_direct"): void {
  if (decision.outcome === "rejected") {
    throw new BlogSafetyRejectedError(decision);
  }

  if (mode === "publish_direct" && decision.outcome === "needs_review") {
    throw new BlogSafetyNeedsReviewError(
      decision,
      "Safety requires review — Trusted Author direct publish is not available for this content.",
    );
  }
}

function assertCanMutatePost(input: {
  post: BlogPost;
  actorParticipantId: string;
  capabilities: ReadonlySet<BlogCapability>;
}): void {
  const isOwner = input.post.authorParticipantId === input.actorParticipantId;
  if (isOwner) {
    return;
  }

  if (!canEditOthersDrafts(input.capabilities)) {
    throw new BlogAccessDeniedError("You cannot mutate another Author's Blog post.");
  }
}

export async function createBlogDraft(input: {
  actorParticipantId: string;
  actorDisplayName?: string;
  role?: AuthRole;
  body: unknown;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canCreateBlogDraft(capabilities)) {
    throw new BlogAccessDeniedError("Author capability is required to create a Blog draft.");
  }
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  const fields = validateCreateBlogDraftInput(input.body);
  const gatedOptimization = await gateBlogPublicationOptimizationAgainstPlatformAccounts(
    fields.optimization,
  );
  const safety = await evaluateBlogSafety({
    actorParticipantId: input.actorParticipantId,
    title: fields.title,
    excerpt: fields.excerpt,
    content: fields.content,
  });
  applySafetyGate(safety, "store");

  const now = new Date().toISOString();
  const post: BlogPost = {
    postId: `blog-${randomUUID()}`,
    authorParticipantId: input.actorParticipantId,
    authorDisplayNameSnapshot: (input.actorDisplayName ?? "Participant").trim() || "Participant",
    title: fields.title,
    slug: await allocateUniqueSlug(fields.title),
    excerpt: fields.excerpt,
    content: fields.content,
    categoryId: fields.categoryId,
    tags: fields.tags,
    coverMedia: fields.coverMedia,
    status: "draft",
    originalLanguage: fields.originalLanguage,
    safetyOutcome: safety.outcome,
    review: { reviewStatus: "none" },
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...(fields.publicationDate
      ? { publishedAt: publicationDateOnlyToIso(fields.publicationDate) }
      : {}),
    ...(gatedOptimization ? { optimization: gatedOptimization } : {}),
  };

  await insertBlogPost(post);
  return toBlogAuthorWorkspacePost(post);
}

export async function updateBlogDraft(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  body: unknown;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  assertCanMutatePost({
    post: existing,
    actorParticipantId: input.actorParticipantId,
    capabilities,
  });
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  if (existing.status === "submitted_for_review") {
    throw new BlogConflictError(
      "Posts under review cannot be edited. Withdraw to draft or wait for editorial feedback.",
    );
  }

  if (existing.status === "archived") {
    throw new BlogConflictError("Archived posts cannot be edited.");
  }

  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be edited or republished.",
    );
  }

  const patch = validateUpdateBlogDraftInput(input.body);
  if ("optimization" in patch) {
    patch.optimization = await gateBlogPublicationOptimizationAgainstPlatformAccounts(
      patch.optimization,
    );
  }
  const nextTitle = patch.title ?? existing.title;
  const nextExcerpt = patch.excerpt ?? existing.excerpt;
  const nextContent = patch.content ?? existing.content;

  const safety = await evaluateBlogSafety({
    actorParticipantId: input.actorParticipantId,
    title: nextTitle,
    excerpt: nextExcerpt,
    content: nextContent,
  });
  applySafetyGate(safety, "store");

  let nextSlug = existing.slug;
  // Published slug remains stable even if title changes.
  if (
    (existing.status === "draft" || existing.status === "scheduled") &&
    patch.title &&
    patch.title !== existing.title
  ) {
    nextSlug = await allocateUniqueSlug(patch.title, existing.postId);
  }

  const now = new Date().toISOString();
  let publishedVersion = existing.publishedVersion;
  let nextStatus = existing.status;
  let nextPublishedAt = existing.publishedAt;

  if (patch.publicationDate) {
    nextPublishedAt = publicationDateOnlyToIso(patch.publicationDate);
    if (existing.status === "scheduled" || existing.status === "published") {
      nextStatus = isPublicationDue(nextPublishedAt, now) ? "published" : "scheduled";
      if (nextStatus !== existing.status) {
        assertBlogStatusTransition(existing.status, nextStatus);
      }
    }
  }

  if (existing.status === "published" && nextStatus === "published") {
    if (
      !canDirectPublish(capabilities) &&
      existing.authorParticipantId === input.actorParticipantId &&
      !capabilities.has("trusted_author")
    ) {
      throw new BlogAccessDeniedError(
        "Only Trusted Authors, Editors, or Administrators may update published posts in place. Start a correction to return the post to draft for review.",
      );
    }
    publishedVersion = existing.publishedVersion + 1;
  }

  const { optimization: existingOptimization, ...existingBase } = existing;
  const nextOptimization =
    "optimization" in patch ? patch.optimization : existingOptimization;

  const updated: BlogPost = {
    ...existingBase,
    title: nextTitle,
    slug: nextSlug,
    excerpt: nextExcerpt,
    content: nextContent,
    categoryId: patch.categoryId ?? existing.categoryId,
    tags: patch.tags ?? existing.tags,
    coverMedia: patch.coverMedia !== undefined ? patch.coverMedia : existing.coverMedia,
    originalLanguage: patch.originalLanguage ?? existing.originalLanguage,
    status: nextStatus,
    safetyOutcome: safety.outcome,
    publishedVersion,
    ...(nextPublishedAt ? { publishedAt: nextPublishedAt } : {}),
    updatedAt: now,
    ...(nextOptimization ? { optimization: nextOptimization } : {}),
  };

  await replaceBlogPost(updated);

  if (updated.status === "published") {
    invalidateGlobalSearchIndex();
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "blog_post",
      sourceRecordId: updated.postId,
      reason: "public_update",
    });
    await emitBlogPostPublished({
      postId: updated.postId,
      authorParticipantId: updated.authorParticipantId,
      publishedByParticipantId: input.actorParticipantId,
      publishedVersion: updated.publishedVersion,
      slug: updated.slug,
    });
    void enqueueBlogSocialDistributionBestEffort({
      post: updated,
      actorParticipantId: input.actorParticipantId,
    });
    if (publishedVersion > existing.publishedVersion) {
      recordAdministrationAuditBestEffort({
        actorParticipantId: input.actorParticipantId,
        action: "blog.update_published",
        targetType: "blog_post",
        targetId: updated.postId,
        scope: { scopeType: "blog", scopeId: updated.postId },
        beforeSummary: `publishedVersion=${existing.publishedVersion}`,
        afterSummary: `publishedVersion=${updated.publishedVersion}`,
      });
    }
  }

  return toBlogAuthorWorkspacePost(updated);
}

export async function getBlogAuthorWorkspacePost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const post = await findBlogPostById(input.postId);
  if (!post) {
    throw new BlogNotFoundError();
  }

  const isOwner = post.authorParticipantId === input.actorParticipantId;
  if (!isOwner && !canEditOthersDrafts(capabilities)) {
    throw new BlogAccessDeniedError();
  }

  return toBlogAuthorWorkspacePost(post);
}

export async function previewBlogPost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}) {
  const workspace = await getBlogAuthorWorkspacePost(input);
  const post = await findBlogPostById(workspace.postId);
  if (!post) {
    throw new BlogNotFoundError();
  }

  const author = await resolveBlogPublicAuthor({
    authorParticipantId: post.authorParticipantId,
    authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
  });

  return toBlogPreviewProjection(post, author);
}

export async function submitBlogPostForReview(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canCreateBlogDraft(capabilities)) {
    throw new BlogAccessDeniedError();
  }
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be submitted for review.",
    );
  }

  if (existing.authorParticipantId !== input.actorParticipantId && !canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError();
  }

  // Pack 16G — Trusted Publishing: server-resolved Author setting bypasses manual review.
  // Never trust a client-supplied flag. Pending-review queue is not auto-released by setting changes.
  const trustedPublishing =
    existing.status === "draft" &&
    existing.authorParticipantId === input.actorParticipantId &&
    (await resolvePublishWithoutManualReview(input.actorParticipantId));
  if (trustedPublishing) {
    const published = await publishBlogPostInternal({
      existing,
      actorParticipantId: input.actorParticipantId,
      capabilities,
      allowTrustedPublishingBypass: true,
    });
    return toBlogAuthorWorkspacePost(published);
  }

  assertBlogStatusTransition(existing.status, "submitted_for_review");
  requirePublishableContent(existing);

  const safety = await evaluateBlogSafety({
    actorParticipantId: input.actorParticipantId,
    title: existing.title,
    excerpt: existing.excerpt,
    content: existing.content,
  });

  if (safety.outcome === "rejected") {
    throw new BlogSafetyRejectedError(safety);
  }

  const now = new Date().toISOString();
  const isResubmit = existing.review.reviewStatus === "changes_requested";
  const updated: BlogPost = {
    ...existing,
    status: "submitted_for_review",
    safetyOutcome: safety.outcome,
    review: {
      reviewStatus: "pending",
      reviewNote: existing.review.reviewNote,
    },
    submittedAt: now,
    submittedByParticipantId: input.actorParticipantId,
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: isResubmit ? "resubmitted" : "submitted",
        safetyOutcome: safety.outcome,
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  await emitBlogPostSubmittedForReview({
    postId: updated.postId,
    authorParticipantId: updated.authorParticipantId,
    actorParticipantId: input.actorParticipantId,
  });
  // Pack 14B — Admin attention only on material not-in-review → in-review transition.
  await emitBlogPublicationAdminReviewNotifications({
    authorParticipantId: updated.authorParticipantId,
    postId: updated.postId,
    title: updated.title,
    submittedAt: updated.submittedAt ?? now,
  });

  return toBlogAuthorWorkspacePost(updated);
}

export async function withdrawBlogPostToDraft(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  const isOwner = existing.authorParticipantId === input.actorParticipantId;
  if (!isOwner && !canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError();
  }
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  assertBlogStatusTransition(existing.status, "draft");

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "draft",
    review: {
      ...existing.review,
      reviewStatus:
        existing.review.reviewStatus === "pending" ? "none" : existing.review.reviewStatus,
    },
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: "withdrawn",
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  return toBlogAuthorWorkspacePost(updated);
}

/**
 * Pack 16A — Standard Author correction path.
 * Returns a published post to draft (same postId/slug/Author) so replacement
 * content is never public until review/publish. Trusted Authors update in place.
 */
export async function startPublishedCorrection(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  const isOwner = existing.authorParticipantId === input.actorParticipantId;
  if (!isOwner && !canEditOthersDrafts(capabilities)) {
    throw new BlogAccessDeniedError();
  }
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be corrected.",
    );
  }

  if (existing.status !== "published") {
    throw new BlogConflictError("Only published publications can start a correction.");
  }

  if (canDirectPublish(capabilities)) {
    throw new BlogConflictError(
      "Trusted Authors, Editors, and Administrators correct published posts in place via Edit.",
    );
  }

  assertBlogStatusTransition(existing.status, "draft");

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "draft",
    review: {
      reviewStatus: "none",
    },
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: "correction_started",
        publishedVersion: existing.publishedVersion,
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  invalidateGlobalSearchIndex();

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "blog.published_correction_started",
    targetType: "blog_post",
    targetId: updated.postId,
    scope: { scopeType: "blog", scopeId: updated.postId },
    beforeSummary: `status=published;publishedVersion=${existing.publishedVersion}`,
    afterSummary: "status=draft;correction_started",
  });

  return toBlogAuthorWorkspacePost(updated);
}

export async function requestBlogPostChanges(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  reviewNote?: string;
  expectedUpdatedAt?: string;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError("Editor capability is required to request changes.");
  }

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  assertExpectedUpdatedAt(existing, input.expectedUpdatedAt);

  if (existing.status !== "submitted_for_review") {
    throw new BlogConflictError("Changes can only be requested on posts submitted for review.");
  }

  assertBlogStatusTransition(existing.status, "draft");
  const note = requireReviewNote(input.reviewNote, "request changes");

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "draft",
    review: {
      reviewStatus: "changes_requested",
      reviewedByParticipantId: input.actorParticipantId,
      reviewedAt: now,
      reviewNote: note,
    },
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: "changes_requested",
        reviewNote: note,
        safetyOutcome: existing.safetyOutcome,
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  await emitBlogPostChangesRequested({
    postId: updated.postId,
    authorParticipantId: updated.authorParticipantId,
    reviewedByParticipantId: input.actorParticipantId,
  });
  await emitBlogPostChangesRequestedNotification({
    authorParticipantId: updated.authorParticipantId,
    postId: updated.postId,
  });

  return toBlogAuthorWorkspacePost(updated);
}

/** Editorial Decline — preserves the post as draft with reviewStatus declined. */
export async function declineBlogPost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  reviewNote?: string;
  expectedUpdatedAt?: string;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError("Editor capability is required to decline a publication.");
  }

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  assertExpectedUpdatedAt(existing, input.expectedUpdatedAt);

  if (existing.status !== "submitted_for_review") {
    throw new BlogConflictError("Only submitted publications can be declined.");
  }

  assertBlogStatusTransition(existing.status, "draft");
  const note = requireReviewNote(input.reviewNote, "decline this publication");

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "draft",
    review: {
      reviewStatus: "declined",
      reviewedByParticipantId: input.actorParticipantId,
      reviewedAt: now,
      reviewNote: note,
    },
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: "declined",
        reviewNote: note,
        safetyOutcome: existing.safetyOutcome,
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  await emitBlogPostEditoriallyDeclined({
    postId: updated.postId,
    authorParticipantId: updated.authorParticipantId,
    reviewedByParticipantId: input.actorParticipantId,
  });
  await emitBlogPostDeclinedNotification({
    authorParticipantId: updated.authorParticipantId,
    postId: updated.postId,
  });

  return toBlogAuthorWorkspacePost(updated);
}

async function publishBlogPostInternal(input: {
  existing: BlogPost;
  actorParticipantId: string;
  capabilities: ReadonlySet<BlogCapability>;
  /** Ordinary Approve & Publish never bypasses needs_review. */
  allowNeedsReviewOverride?: boolean;
  reviewNote?: string;
  expectedUpdatedAt?: string;
  /** Pack 13C — YYYY-MM-DD optional override at publish time. */
  publicationDate?: string;
  /**
   * Pack 16G — server already resolved Trusted Publishing for this owner submit/publish.
   * Does not weaken Safety, blocks, or scheduling.
   */
  allowTrustedPublishingBypass?: boolean;
}): Promise<BlogPost> {
  const { existing, actorParticipantId, capabilities } = input;
  assertExpectedUpdatedAt(existing, input.expectedUpdatedAt);
  requirePublishableContent(existing);

  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be published.",
    );
  }

  const isOwner = existing.authorParticipantId === actorParticipantId;
  const fromDraft = existing.status === "draft";
  const fromSubmitted = existing.status === "submitted_for_review";
  const fromScheduled = existing.status === "scheduled";
  const fromArchived = existing.status === "archived";
  const mayBypassManualReview =
    input.allowTrustedPublishingBypass === true ||
    (await actorMayBypassManualReview({
      participantId: actorParticipantId,
      capabilities,
    }));

  if (fromArchived) {
    if (!canRestoreArchived(capabilities)) {
      throw new BlogAccessDeniedError("Only Administrators may restore archived Blog posts.");
    }
  } else if (fromDraft || fromScheduled) {
    if (!isOwner && !canEditorialPublish(capabilities)) {
      throw new BlogAccessDeniedError();
    }
    if (isOwner && !mayBypassManualReview && fromDraft) {
      throw new BlogAccessDeniedError(
        "Standard Authors must submit for review; direct publish requires Trusted Author, Editor, Administrator, or Trusted Publishing.",
      );
    }
  } else if (fromSubmitted) {
    if (!canEditorialPublish(capabilities) && !(isOwner && mayBypassManualReview)) {
      throw new BlogAccessDeniedError("Editor capability is required to publish submitted posts.");
    }
  } else {
    throw new BlogConflictError(`Cannot publish from status ${existing.status}.`);
  }

  const now = new Date().toISOString();
  const resolvedPublishedAt = input.publicationDate
    ? publicationDateOnlyToIso(input.publicationDate)
    : existing.publishedAt ?? now;
  const targetStatus: BlogPostStatus = isPublicationDue(resolvedPublishedAt, now)
    ? "published"
    : "scheduled";

  if (existing.status !== targetStatus) {
    assertBlogStatusTransition(existing.status, targetStatus);
  }

  const safety = await evaluateBlogSafety({
    actorParticipantId,
    title: existing.title,
    excerpt: existing.excerpt,
    content: existing.content,
  });

  if (safety.outcome === "rejected") {
    throw new BlogSafetyRejectedError(safety);
  }

  // Pack 06 — ordinary publish never silently overrides needs_review.
  // Editors must use publishBlogPostAfterSafetyReview explicitly.
  if (safety.outcome === "needs_review" && !input.allowNeedsReviewOverride) {
    throw new BlogSafetyNeedsReviewError(
      safety,
      "Safety requires review — use Publish After Safety Review with an explicit reason.",
    );
  }

  if (input.allowNeedsReviewOverride && safety.outcome !== "needs_review") {
    throw new BlogConflictError(
      "Publish After Safety Review applies only when Safety state is needs_review.",
    );
  }

  if (input.allowNeedsReviewOverride && !canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError(
      "Editor capability is required for Publish After Safety Review.",
    );
  }

  const overrideNote = input.allowNeedsReviewOverride
    ? requireReviewNote(input.reviewNote, "publish after Safety review")
    : input.reviewNote?.trim() || existing.review.reviewNote;

  const nextVersion =
    targetStatus === "published"
      ? existing.publishedVersion > 0
        ? existing.publishedVersion + 1
        : 1
      : existing.publishedVersion;
  const historyAction = input.allowNeedsReviewOverride
    ? "published_after_safety_review"
    : "approved_published";

  const updated: BlogPost = {
    ...existing,
    status: targetStatus,
    safetyOutcome: safety.outcome,
    review: {
      reviewStatus: targetStatus === "published" ? "approved" : existing.review.reviewStatus,
      reviewedByParticipantId: actorParticipantId,
      reviewedAt: now,
      reviewNote: overrideNote,
    },
    publishedVersion: nextVersion,
    publishedAt: resolvedPublishedAt,
    publishedByParticipantId: actorParticipantId,
    archivedAt: undefined,
    archivedByParticipantId: undefined,
    updatedAt: now,
    editorialHistory:
      targetStatus === "published"
        ? appendEditorialHistory(
            existing,
            buildEditorialHistoryEntry({
              at: now,
              actorParticipantId,
              action: historyAction,
              reviewNote: overrideNote,
              safetyOutcome: safety.outcome,
              publishedVersion: nextVersion,
              contentUpdatedAt: existing.updatedAt,
            }),
          )
        : existing.editorialHistory,
  };

  await replaceBlogPost(updated);

  // Pack 14B — Author decision notification for both immediate publish and future schedule.
  if (updated.status === "published" || updated.status === "scheduled") {
    await emitBlogPostPublishedNotification({
      authorParticipantId: updated.authorParticipantId,
      postId: updated.postId,
    });
  }

  if (updated.status === "published") {
    invalidateGlobalSearchIndex();
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "blog_post",
      sourceRecordId: updated.postId,
      reason: "public_mutation",
    });
    await emitBlogPostPublished({
      postId: updated.postId,
      authorParticipantId: updated.authorParticipantId,
      publishedByParticipantId: actorParticipantId,
      publishedVersion: updated.publishedVersion,
      slug: updated.slug,
      afterSafetyReview: Boolean(input.allowNeedsReviewOverride),
      safetyOutcome: safety.outcome,
      reviewNote: overrideNote,
    });
    void enqueueBlogSocialDistributionBestEffort({
      post: updated,
      actorParticipantId,
    });

    recordAdministrationAuditBestEffort({
      actorParticipantId,
      action: input.allowNeedsReviewOverride
        ? "blog.publish_after_safety_review"
        : "blog.publish",
      targetType: "blog_post",
      targetId: updated.postId,
      scope: { scopeType: "blog", scopeId: updated.postId },
      reason: input.allowNeedsReviewOverride ? overrideNote : undefined,
      afterSummary: `status=published version=${updated.publishedVersion} safety=${safety.outcome}`,
    });
    if (input.allowNeedsReviewOverride) {
      recordAdministrationAuditBestEffort({
        actorParticipantId,
        action: "safety.override",
        targetType: "blog_post",
        targetId: updated.postId,
        scope: { scopeType: "blog", scopeId: updated.postId },
        reason: overrideNote,
        afterSummary: "published_after_safety_review",
      });
    }
  } else {
    recordAdministrationAuditBestEffort({
      actorParticipantId,
      action: "blog.publish",
      targetType: "blog_post",
      targetId: updated.postId,
      scope: { scopeType: "blog", scopeId: updated.postId },
      afterSummary: `status=scheduled publishedAt=${updated.publishedAt}`,
    });
  }

  return updated;
}

export async function publishBlogPost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  expectedUpdatedAt?: string;
  reviewNote?: string;
  publicationDate?: string;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  const published = await publishBlogPostInternal({
    existing,
    actorParticipantId: input.actorParticipantId,
    capabilities,
    expectedUpdatedAt: input.expectedUpdatedAt,
    reviewNote: input.reviewNote,
    publicationDate: input.publicationDate,
  });

  return toBlogAuthorWorkspacePost(published);
}

/** Pack 13C — cancel future schedule; returns to draft retaining intended publishedAt. */
export async function cancelScheduledBlogPublication(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }
  if (existing.authorParticipantId !== input.actorParticipantId && !canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError();
  }
  if (existing.status !== "scheduled") {
    throw new BlogConflictError("Only scheduled publications can cancel a schedule.");
  }
  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be modified.",
    );
  }

  assertBlogStatusTransition(existing.status, "draft");
  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "draft",
    updatedAt: now,
  };
  await replaceBlogPost(updated);
  return toBlogAuthorWorkspacePost(updated);
}

/**
 * Pack 13C — promote due scheduled posts to published.
 * Called by in-process scheduler (not browser-dependent).
 * Skips administratively blocked posts.
 *
 * Pack 13E certification policy:
 * If the Author is soft-blocked at release time, do NOT newly go public.
 * The post stays `scheduled` until the Author is unblocked (or an Editor publishes).
 * Publication soft-block remains independent and also suppresses release.
 */
export async function releaseDueScheduledBlogPublications(input?: {
  nowIso?: string;
  limit?: number;
}): Promise<{ releasedCount: number; releasedPostIds: string[] }> {
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const due = await listDueScheduledBlogPosts({
    nowIso,
    limit: input?.limit ?? 100,
  });

  const releasedPostIds: string[] = [];
  for (const post of due) {
    if (!post.publishedAt || post.administrativelyBlocked === true) {
      continue;
    }
    if (post.status !== "scheduled") {
      continue;
    }
    if (await isBlogAuthorAdministrativelyBlocked(post.authorParticipantId)) {
      continue;
    }

    const now = new Date().toISOString();
    const nextVersion = post.publishedVersion > 0 ? post.publishedVersion + 1 : 1;
    const updated: BlogPost = {
      ...post,
      status: "published",
      publishedVersion: nextVersion,
      updatedAt: now,
      editorialHistory: appendEditorialHistory(
        post,
        buildEditorialHistoryEntry({
          at: now,
          actorParticipantId: post.publishedByParticipantId ?? post.authorParticipantId,
          action: "approved_published",
          publishedVersion: nextVersion,
          contentUpdatedAt: post.updatedAt,
        }),
      ),
    };
    await replaceBlogPost(updated);
    invalidateGlobalSearchIndex();
    await emitBlogPostPublished({
      postId: updated.postId,
      authorParticipantId: updated.authorParticipantId,
      publishedByParticipantId: updated.publishedByParticipantId ?? updated.authorParticipantId,
      publishedVersion: updated.publishedVersion,
      slug: updated.slug,
    });
    void enqueueBlogSocialDistributionBestEffort({
      post: updated,
      actorParticipantId: updated.publishedByParticipantId ?? updated.authorParticipantId,
    });
    await emitBlogPostPublishedNotification({
      authorParticipantId: updated.authorParticipantId,
      postId: updated.postId,
    });
    releasedPostIds.push(updated.postId);
  }

  return { releasedCount: releasedPostIds.length, releasedPostIds };
}

/**
 * Explicit Editor/Admin accountability path when Safety = needs_review.
 * Does not imply the Safety system was wrong — records human responsibility.
 */
export async function publishBlogPostAfterSafetyReview(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  reviewNote?: string;
  expectedUpdatedAt?: string;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError(
      "Editor capability is required for Publish After Safety Review.",
    );
  }

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  const published = await publishBlogPostInternal({
    existing,
    actorParticipantId: input.actorParticipantId,
    capabilities,
    allowNeedsReviewOverride: true,
    reviewNote: input.reviewNote,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });

  return toBlogAuthorWorkspacePost(published);
}

export async function archiveBlogPost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  const isOwner = existing.authorParticipantId === input.actorParticipantId;
  if (!isOwner && !canArchiveAny(capabilities)) {
    throw new BlogAccessDeniedError();
  }

  await assertAuthorPublishingAllowed({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    capabilities,
  });

  if (existing.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(
      "This publication is blocked by an administrator and cannot be deleted or archived by the Author.",
    );
  }

  assertBlogStatusTransition(existing.status, "archived");

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...existing,
    status: "archived",
    archivedAt: now,
    archivedByParticipantId: input.actorParticipantId,
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
      existing,
      buildEditorialHistoryEntry({
        at: now,
        actorParticipantId: input.actorParticipantId,
        action: "archived",
        contentUpdatedAt: existing.updatedAt,
      }),
    ),
  };

  await replaceBlogPost(updated);
  invalidateGlobalSearchIndex();
  await emitBlogPostArchived({
    postId: updated.postId,
    authorParticipantId: updated.authorParticipantId,
    archivedByParticipantId: input.actorParticipantId,
  });

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "blog.archive",
    targetType: "blog_post",
    targetId: updated.postId,
    scope: { scopeType: "blog", scopeId: updated.postId },
    afterSummary: "status=archived",
  });

  return toBlogAuthorWorkspacePost(updated);
}

/** Editorial Review Pack 06 — pending review queue (oldest submitted first). */
export async function listEditorialReviewQueue(input: {
  actorParticipantId: string;
  role?: AuthRole;
  limit?: number;
  offset?: number;
}): Promise<BlogEditorialQueueResponse> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError("Editor capability is required for Editorial Review.");
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const result = await listBlogPostsForEditorialQueue({
    status: "submitted_for_review",
    limit,
    offset,
  });

  const items = await Promise.all(
    result.items.map(async (post) => {
      const author = await resolveBlogPublicAuthor({
        authorParticipantId: post.authorParticipantId,
        authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
      });
      return {
        postId: post.postId,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        categoryId: post.categoryId,
        tags: [...post.tags],
        coverMedia: post.coverMedia ? { ...post.coverMedia } : null,
        status: post.status,
        safetyOutcome: post.safetyOutcome,
        review: { ...post.review },
        publishedVersion: post.publishedVersion,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        submittedAt: post.submittedAt,
        authorParticipantId: post.authorParticipantId,
        authorDisplayName: author.displayName,
      };
    }),
  );

  return { items, total: result.total, limit, offset };
}

/** Editorial review detail — sanitized workspace content + Author identity. */
export async function getEditorialReviewDetail(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogEditorialReviewDetail> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError("Editor capability is required for Editorial Review.");
  }

  const post = await findBlogPostById(input.postId);
  if (!post) {
    throw new BlogNotFoundError();
  }

  const author = await resolveBlogPublicAuthor({
    authorParticipantId: post.authorParticipantId,
    authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
  });
  const authorAdministrativelyBlocked = await isBlogAuthorAdministrativelyBlocked(
    post.authorParticipantId,
  );

  return {
    ...toBlogAuthorWorkspacePost(post),
    authorParticipantId: post.authorParticipantId,
    authorDisplayName: author.displayName,
    ...(authorAdministrativelyBlocked ? { authorAdministrativelyBlocked: true } : {}),
  };
}

export async function listPublicBlogPosts(input: {
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  categoryId?: string;
  q?: string;
  includeDiscovery?: boolean;
}): Promise<PublicBlogPostListResponse> {
  const pageSize =
    input.pageSize !== undefined
      ? Math.min(Math.max(input.pageSize, 1), 100)
      : Math.min(Math.max(input.limit ?? 20, 1), 100);
  const page =
    input.page !== undefined
      ? Math.max(input.page, 1)
      : Math.floor(Math.max(input.offset ?? 0, 0) / pageSize) + 1;
  const offset =
    input.page !== undefined ? (page - 1) * pageSize : Math.max(input.offset ?? 0, 0);
  const limit = pageSize;

  let categoryId: BlogPost["categoryId"] | undefined;
  if (input.categoryId) {
    await ensureBlogCategoriesSeeded();
    const { isBlogCategoryId } = await import("./blog-categories.js");
    // Pack 16F — inactive categories remain filterable for historical deep links.
    if (!isBlogCategoryId(input.categoryId)) {
      throw new BlogValidationError("Invalid categoryId filter.");
    }
    categoryId = input.categoryId;
  } else {
    await ensureBlogCategoriesSeeded();
  }

  const includeDiscovery = input.includeDiscovery !== false;

  const [{ items, total }, categoryAgg, latestListed, blogIndexViews] = await Promise.all([
    listPublishedBlogPosts({
      limit,
      offset,
      categoryId,
      q: input.q,
    }),
    includeDiscovery
      ? aggregatePublishedBlogPostCountsByCategory()
      : Promise.resolve([] as ReadonlyArray<{ categoryId: BlogCategoryId; count: number }>),
    includeDiscovery
      ? listPublishedBlogPosts({ limit: 4, offset: 0 })
      : Promise.resolve({ items: [] as BlogPost[], total: 0 }),
    includeDiscovery
      ? import("../traffic-analytics/traffic-aggregate.repository.js").then((mod) =>
          mod.getPublicBlogIndexViewCount().catch(() => 0),
        )
      : Promise.resolve(0),
  ]);

  const { countVisibleBlogCommentsByPostIds } = await import(
    "./persistence/blog-comment.repository.js"
  );
  const feedIds = items.map((post) => post.postId);
  const latestIds = latestListed.items.map((post) => post.postId);
  const commentCounts = await countVisibleBlogCommentsByPostIds([
    ...new Set([...feedIds, ...latestIds]),
  ]);

  async function projectPosts(posts: readonly BlogPost[]) {
    const projected = [];
    for (const post of posts) {
      const author = await resolveBlogPublicAuthor({
        authorParticipantId: post.authorParticipantId,
        authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
      });
      projected.push(
        toPublicBlogPostListItem(post, author, commentCounts.get(post.postId) ?? 0),
      );
    }
    return projected;
  }

  const projected = await projectPosts(items);
  const latestPublications = includeDiscovery
    ? await projectPosts(latestListed.items)
    : undefined;

  const countById = new Map(categoryAgg.map((row) => [row.categoryId, row.count]));
  const categoryCounts = includeDiscovery
    ? listBlogCategories().map((category) => ({
        categoryId: category.categoryId,
        name: category.name,
        slug: category.slug,
        count: countById.get(category.categoryId) ?? 0,
      }))
    : undefined;

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const response: PublicBlogPostListResponse = {
    items: projected,
    total,
    limit,
    offset,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : totalPages,
    ...(categoryCounts ? { categoryCounts } : {}),
    ...(latestPublications ? { latestPublications } : {}),
    ...(includeDiscovery ? { blogIndexViews } : {}),
  };
  assertNoInternalBlogFields(response);
  return response;
}

/** Pack 13D — Authors rail: one row per author with a visible public publication. */
export async function listPublicBlogAuthors(input?: {
  limit?: number;
}): Promise<PublicBlogAuthorDirectoryResponse> {
  const rows = await listLatestPublicBlogPostsByAuthor({
    limitAuthors: input?.limit ?? 40,
  });

  const authors = [];
  for (const row of rows) {
    const author = await resolveBlogPublicAuthor({
      authorParticipantId: row.authorParticipantId,
      authorDisplayNameSnapshot: row.authorDisplayNameSnapshot,
    });
    authors.push({
      author,
      latestPublication: {
        postId: row.postId,
        slug: row.slug,
        title: row.title,
        publishedAt: row.publishedAt,
      },
    });
  }

  const response: PublicBlogAuthorDirectoryResponse = { authors };
  assertNoInternalBlogFields(response);
  return response;
}

export async function getPublicBlogPostBySlug(
  slug: string,
  viewerParticipantId?: string | null,
): Promise<PublicBlogPostDetail> {
  const post = await findBlogPostBySlug(slug.trim());
  const now = new Date().toISOString();
  if (
    !post ||
    post.status !== "published" ||
    post.administrativelyBlocked === true ||
    !post.publishedAt ||
    post.publishedAt > now
  ) {
    throw new BlogNotFoundError("Published Blog post not found.");
  }

  const author = await resolveBlogPublicAuthor({
    authorParticipantId: post.authorParticipantId,
    authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
  });

  const { getVisibleBlogCommentCount, getBlogPostReactionSummary } = await import(
    "./blog-interaction.service.js"
  );
  const [commentCount, reactions] = await Promise.all([
    getVisibleBlogCommentCount(post.postId),
    getBlogPostReactionSummary({
      postId: post.postId,
      actorParticipantId: viewerParticipantId ?? null,
    }),
  ]);

  const detail = toPublicBlogPostDetail(post, author, {
    helpful: reactions.helpful,
    notHelpful: reactions.notHelpful,
    commentCount,
    currentUserReaction: viewerParticipantId ? reactions.currentUserReaction : undefined,
  });
  assertNoInternalBlogFields(detail);
  return detail;
}

function deriveAuthoringPresentation(input: {
  capabilities: ReadonlySet<BlogCapability>;
  application: BlogAuthorApplication | null;
  authorAdministrativelyBlocked: boolean;
}): BlogAuthoringAccessState["presentation"] {
  if (
    input.authorAdministrativelyBlocked &&
    (input.capabilities.has("author") || input.capabilities.has("trusted_author")) &&
    !input.capabilities.has("editor") &&
    !input.capabilities.has("administrator")
  ) {
    return "author_blocked";
  }
  if (input.capabilities.has("administrator")) {
    return "administrator";
  }
  if (input.capabilities.has("editor")) {
    return "editor";
  }
  if (input.capabilities.has("trusted_author")) {
    return "trusted_author";
  }
  if (input.capabilities.has("author")) {
    return "author";
  }

  switch (input.application?.status) {
    case "submitted":
      return "application_submitted";
    case "under_review":
      return "application_under_review";
    case "changes_requested":
      return "application_changes_requested";
    case "declined":
      return "application_declined";
    default:
      return "eligible_to_apply";
  }
}

function toAuthoringAccessState(input: {
  participantId: string;
  capabilities: ReadonlySet<BlogCapability>;
  application: BlogAuthorApplication | null;
  authorAdministrativelyBlocked: boolean;
  publishWithoutManualReview: boolean;
}): BlogAuthoringAccessState {
  const presentation = deriveAuthoringPresentation(input);
  const hasAuthor =
    input.capabilities.has("author") ||
    input.capabilities.has("trusted_author") ||
    input.capabilities.has("editor") ||
    input.capabilities.has("administrator");

  const active =
    input.application?.status === "submitted" ||
    input.application?.status === "under_review" ||
    input.application?.status === "changes_requested";

  const isEditor =
    input.capabilities.has("editor") || input.capabilities.has("administrator");

  const blockedAuthorOnly =
    input.authorAdministrativelyBlocked &&
    !input.capabilities.has("editor") &&
    !input.capabilities.has("administrator");

  return {
    participantId: input.participantId,
    capabilities: [...input.capabilities],
    application: input.application,
    presentation,
    canApply: !hasAuthor && !active,
    canResubmit: !hasAuthor && input.application?.status === "changes_requested",
    publishingWorkspaceHref:
      hasAuthor && !blockedAuthorOnly ? "/workspace/publishing" : null,
    navLabel: hasAuthor && !blockedAuthorOnly ? "Publishing" : "Become an Author",
    editorialReviewHref: isEditor ? "/workspace/editorial" : null,
    authorAdministrativelyBlocked: input.authorAdministrativelyBlocked,
    publishWithoutManualReview: input.publishWithoutManualReview,
  };
}

async function ensureAuthorApplicantGrant(participantId: string): Promise<void> {
  const existing = await findBlogCapabilityGrant(participantId);
  const capabilities = new Set<BlogCapability>(existing?.capabilities ?? []);
  capabilities.add("author_applicant");
  await upsertBlogCapabilityGrant({
    participantId,
    capabilities: [...capabilities],
    updatedAt: new Date().toISOString(),
    grantedByParticipantId: existing?.grantedByParticipantId ?? participantId,
  });
}

async function ensureAuthorGrantOnApproval(input: {
  participantId: string;
  grantedByParticipantId: string;
}): Promise<void> {
  const existing = await findBlogCapabilityGrant(input.participantId);
  const capabilities = new Set<BlogCapability>(existing?.capabilities ?? []);
  capabilities.add("author");
  capabilities.delete("author_applicant");

  const grant: BlogCapabilityGrant = {
    participantId: input.participantId,
    capabilities: [...capabilities],
    updatedAt: new Date().toISOString(),
    grantedByParticipantId: input.grantedByParticipantId,
    ...(existing?.administrativelyBlocked === true
      ? {
          administrativelyBlocked: existing.administrativelyBlocked,
          administrativeBlockAuthority: existing.administrativeBlockAuthority,
          administrativelyBlockedAt: existing.administrativelyBlockedAt,
          administrativelyBlockedByParticipantId:
            existing.administrativelyBlockedByParticipantId,
          administrativeBlockReason: existing.administrativeBlockReason,
        }
      : {}),
    // Pack 16G — Trusted Publishing defaults OFF; preserve if Admin already set it.
    ...(existing?.publishWithoutManualReview === true
      ? { publishWithoutManualReview: true }
      : {}),
  };

  await upsertBlogCapabilityGrant(grant);
  await emitBlogAuthorCapabilityGranted({
    participantId: grant.participantId,
    capabilities: grant.capabilities,
    grantedByParticipantId: input.grantedByParticipantId,
  });

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.grantedByParticipantId,
    action: "capability.grant",
    targetType: "blog_capability_grant",
    targetId: grant.participantId,
    scope: { scopeType: "blog" },
    reason: "author_application_approved",
    afterSummary: `capabilities=${grant.capabilities.join(",")}`,
  });
}

async function evaluateAuthorApplicationSafety(input: {
  actorParticipantId: string;
  motivation: string;
  topics: string;
  previousWritingUrl?: string;
}): Promise<void> {
  const text = [input.motivation, input.topics, input.previousWritingUrl]
    .filter(Boolean)
    .join("\n\n");

  const decision = await evaluateLifecycleSafety({
    surfaceId: "blog_post",
    initiativeId: null,
    actorParticipantId: input.actorParticipantId,
    text,
    fieldName: "blog_author_application",
  });

  // Safety focuses on prohibited/harmful content, not editorial quality.
  if (decision.outcome === "rejected") {
    throw new BlogSafetyRejectedError(decision);
  }
}

/** Author Access Pack 04 — capability-aware Workspace Authoring state. */
export async function getBlogAuthoringAccessState(input: {
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogAuthoringAccessState> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const application = await findLatestBlogAuthorApplication(input.actorParticipantId);
  const authorAdministrativelyBlocked = await isBlogAuthorAdministrativelyBlocked(
    input.actorParticipantId,
  );
  const publishWithoutManualReview = await resolvePublishWithoutManualReview(
    input.actorParticipantId,
  );

  return toAuthoringAccessState({
    participantId: input.actorParticipantId,
    capabilities,
    application,
    authorAdministrativelyBlocked,
    publishWithoutManualReview,
  });
}

/** Author Access Pack 04 — submit a Blog Author application. */
export async function applyForBlogAuthorCapability(input: {
  actorParticipantId: string;
  role?: AuthRole;
  body: Record<string, unknown>;
}): Promise<BlogAuthorApplication> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (
    capabilities.has("author") ||
    capabilities.has("trusted_author") ||
    capabilities.has("editor") ||
    capabilities.has("administrator")
  ) {
    throw new BlogConflictError("You already have Blog Author publishing capability.");
  }

  const active = await findActiveBlogAuthorApplication(input.actorParticipantId);
  if (active && active.status !== "changes_requested") {
    throw new BlogConflictError("An active Blog Author application already exists.");
  }

  const fields = validateBlogAuthorApplicationInput(input.body);
  await evaluateAuthorApplicationSafety({
    actorParticipantId: input.actorParticipantId,
    motivation: fields.motivation,
    topics: fields.topics,
    previousWritingUrl: fields.previousWritingUrl,
  });

  const now = new Date().toISOString();

  if (active?.status === "changes_requested") {
    const resubmitted: BlogAuthorApplication = {
      ...active,
      ...fields,
      status: "submitted",
      updatedAt: now,
      reviewNote: undefined,
      decidedAt: undefined,
      decidedByParticipantId: undefined,
    };
    await replaceBlogAuthorApplication(resubmitted);
    await ensureAuthorApplicantGrant(input.actorParticipantId);
    recordAdministrationAuditBestEffort({
      actorParticipantId: input.actorParticipantId,
      action: "blog.author_application.submit",
      targetType: "blog_author_application",
      targetId: resubmitted.applicationId,
      scope: { scopeType: "blog" },
      afterSummary: `status=${resubmitted.status};resubmit=1`,
    });
    await emitBlogAuthorApplicationSubmittedNotification({
      participantId: input.actorParticipantId,
      applicationId: resubmitted.applicationId,
    });
    return resubmitted;
  }

  const application: BlogAuthorApplication = {
    applicationId: `blog-app-${randomUUID()}`,
    participantId: input.actorParticipantId,
    status: "submitted",
    ...fields,
    createdAt: now,
    updatedAt: now,
  };

  await insertBlogAuthorApplication(application);
  await ensureAuthorApplicantGrant(input.actorParticipantId);
  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "blog.author_application.submit",
    targetType: "blog_author_application",
    targetId: application.applicationId,
    scope: { scopeType: "blog" },
    afterSummary: `status=${application.status}`,
  });
  await emitBlogAuthorApplicationSubmittedNotification({
    participantId: input.actorParticipantId,
    applicationId: application.applicationId,
  });

  return application;
}

/** Explicit resubmit after changes_requested (same validation as apply). */
export async function resubmitBlogAuthorApplication(input: {
  actorParticipantId: string;
  role?: AuthRole;
  applicationId: string;
  body: Record<string, unknown>;
}): Promise<BlogAuthorApplication> {
  const existing = await findBlogAuthorApplicationById(input.applicationId);
  if (!existing || existing.participantId !== input.actorParticipantId) {
    throw new BlogNotFoundError("Blog Author application not found.");
  }
  if (existing.status !== "changes_requested") {
    throw new BlogConflictError("Only applications with requested changes can be resubmitted.");
  }

  return applyForBlogAuthorCapability({
    actorParticipantId: input.actorParticipantId,
    role: input.role,
    body: input.body,
  });
}

export type BlogAuthorApplicationDecision =
  | "mark_under_review"
  | "request_changes"
  | "approve"
  | "decline";

/** Editor/Admin review seam — no full Admin Console UI in Pack 04. */
export async function decideBlogAuthorApplication(input: {
  actorParticipantId: string;
  role?: AuthRole;
  applicationId: string;
  decision: BlogAuthorApplicationDecision;
  reviewNote?: string;
}): Promise<BlogAuthorApplication> {
  const actorCaps = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canReviewAuthorApplications(actorCaps)) {
    throw new BlogAccessDeniedError("Editor or Administrator capability is required.");
  }

  const existing = await findBlogAuthorApplicationById(input.applicationId);
  if (!existing) {
    throw new BlogNotFoundError("Blog Author application not found.");
  }

  // Pack 13A — Invite is idempotent when already approved (no duplicate Author grant).
  if (existing.status === "approved" && input.decision === "approve") {
    return existing;
  }

  if (existing.status === "approved" || existing.status === "declined") {
    throw new BlogConflictError("This Blog Author application has already been decided.");
  }

  const now = new Date().toISOString();
  let status: BlogAuthorApplicationStatus;
  const reviewNote = input.reviewNote?.trim() || undefined;

  switch (input.decision) {
    case "mark_under_review":
      status = "under_review";
      break;
    case "request_changes":
      if (!reviewNote) {
        throw new BlogValidationError("reviewNote is required when requesting changes.");
      }
      status = "changes_requested";
      break;
    case "approve":
      status = "approved";
      break;
    case "decline":
      status = "declined";
      break;
    default:
      throw new BlogValidationError("Unknown application decision.");
  }

  const updated: BlogAuthorApplication = {
    ...existing,
    status,
    reviewNote: status === "under_review" ? existing.reviewNote : reviewNote,
    updatedAt: now,
    decidedAt: status === "approved" || status === "declined" ? now : existing.decidedAt,
    decidedByParticipantId:
      status === "approved" || status === "declined"
        ? input.actorParticipantId
        : existing.decidedByParticipantId,
  };

  await replaceBlogAuthorApplication(updated);

  if (status === "approved") {
    await ensureAuthorGrantOnApproval({
      participantId: existing.participantId,
      grantedByParticipantId: input.actorParticipantId,
    });
    await emitBlogAuthorApplicationApprovedNotification({
      participantId: existing.participantId,
      applicationId: existing.applicationId,
    });
  } else if (status === "changes_requested") {
    await emitBlogAuthorApplicationChangesRequestedNotification({
      participantId: existing.participantId,
      applicationId: existing.applicationId,
    });
  } else if (status === "declined") {
    await emitBlogAuthorApplicationDeclinedNotification({
      participantId: existing.participantId,
      applicationId: existing.applicationId,
      reviewNote,
    });
  }

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "blog.author_application.decide",
    targetType: "blog_author_application",
    targetId: existing.applicationId,
    scope: { scopeType: "blog" },
    reason: reviewNote,
    beforeSummary: `status=${existing.status}`,
    afterSummary: `status=${status}`,
  });

  return updated;
}

/**
 * Pack 13A — Admin-only Author application review projection for Notification Center modal.
 */
export async function getAdminAuthorApplicationReview(input: {
  actorUserId: string;
  applicationId: string;
}): Promise<AdminAuthorApplicationReview> {
  const actor = await findAuthUserById(input.actorUserId);
  if (!actor || actor.role !== "admin") {
    throw new BlogAccessDeniedError("Administrator access is required.");
  }

  const application = await findBlogAuthorApplicationById(input.applicationId);
  if (!application) {
    throw new BlogNotFoundError("Blog Author application not found.");
  }

  const authUser = await findAuthUserByMemberId(application.participantId);
  let uniqueName: string | undefined;
  try {
    const member = await findMemberById(application.participantId);
    uniqueName = member?.uniqueName;
  } catch {
    // Member aggregate optional in some test paths.
  }
  const profile = authUser ? await findMemberProfileByUserId(authUser.userId) : null;
  const displayName =
    profile?.displayName?.trim() ||
    authUser?.displayName?.trim() ||
    authUser?.email ||
    application.participantId;

  return {
    applicationId: application.applicationId,
    participantId: application.participantId,
    displayName,
    ...(uniqueName ? { uniqueName } : {}),
    email: authUser?.email ?? "",
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    status: application.status,
    motivation: application.motivation,
    topics: application.topics,
    ...(application.previousWritingUrl
      ? { previousWritingUrl: application.previousWritingUrl }
      : {}),
    preferredCategoryIds: application.preferredCategoryIds,
    agreedToStandards: application.agreedToStandards,
    submittedAt: application.createdAt,
    updatedAt: application.updatedAt,
    ...(application.decidedAt ? { decidedAt: application.decidedAt } : {}),
    ...(application.reviewNote ? { reviewNote: application.reviewNote } : {}),
  };
}

/** Admin Invite (approve) / Refuse (decline) — JWT Admin role required. */
export async function decideBlogAuthorApplicationAsAdmin(input: {
  actorUserId: string;
  applicationId: string;
  decision: "approve" | "decline";
  reviewNote?: string;
}): Promise<BlogAuthorApplication> {
  const actor = await findAuthUserById(input.actorUserId);
  if (!actor || actor.role !== "admin") {
    throw new BlogAccessDeniedError("Administrator access is required.");
  }

  return decideBlogAuthorApplication({
    actorParticipantId: actor.memberId,
    role: actor.role,
    applicationId: input.applicationId,
    decision: input.decision,
    reviewNote: input.reviewNote,
  });
}

/** Admin-only grant for capability foundation / tests. */
export async function grantBlogCapabilities(input: {
  actorParticipantId: string;
  role?: AuthRole;
  targetParticipantId: string;
  capabilities: readonly BlogCapability[];
}): Promise<BlogCapabilityGrant> {
  const actorCaps = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });

  if (!canManageAuthorGrants(actorCaps) && input.role !== "admin") {
    throw new BlogAccessDeniedError("Administrator capability is required to grant Blog capabilities.");
  }

  const allowed = input.capabilities.filter(
    (c): c is BlogCapability =>
      c === "author_applicant" ||
      c === "author" ||
      c === "trusted_author" ||
      c === "editor" ||
      c === "administrator",
  );

  if (allowed.length === 0) {
    throw new BlogValidationError("At least one valid Blog capability is required.");
  }

  const grant: BlogCapabilityGrant = {
    participantId: input.targetParticipantId,
    capabilities: allowed,
    updatedAt: new Date().toISOString(),
    grantedByParticipantId: input.actorParticipantId,
  };

  await upsertBlogCapabilityGrant(grant);
  await emitBlogAuthorCapabilityGranted({
    participantId: grant.participantId,
    capabilities: grant.capabilities,
    grantedByParticipantId: input.actorParticipantId,
  });

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "capability.grant",
    targetType: "blog_capability_grant",
    targetId: grant.participantId,
    scope: { scopeType: "blog" },
    reason:
      allowed.includes("administrator") || allowed.includes("editor")
        ? "high_impact_capability_grant"
        : undefined,
    afterSummary: `capabilities=${grant.capabilities.join(",")}`,
  });

  return grant;
}

/** Test helper — grant without admin actor. */
export async function grantBlogCapabilitiesForTests(input: {
  participantId: string;
  capabilities: readonly BlogCapability[];
  publishWithoutManualReview?: boolean;
}): Promise<BlogCapabilityGrant> {
  return upsertBlogCapabilityGrant({
    participantId: input.participantId,
    capabilities: input.capabilities,
    updatedAt: new Date().toISOString(),
    grantedByParticipantId: "system-test",
    ...(input.publishWithoutManualReview === true
      ? { publishWithoutManualReview: true }
      : {}),
  });
}
