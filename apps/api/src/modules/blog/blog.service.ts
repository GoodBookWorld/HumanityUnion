import { randomUUID } from "node:crypto";

import type {
  AuthRole,
  BlogAuthorApplication,
  BlogAuthorApplicationStatus,
  BlogAuthoringAccessState,
  BlogAuthorWorkspacePost,
  BlogAuthorWorkspacePostListResponse,
  BlogCapability,
  BlogCapabilityGrant,
  BlogEditorialQueueResponse,
  BlogEditorialReviewDetail,
  BlogPost,
  BlogPostStatus,
  LifecycleSafetyDecision,
  PublicBlogPostDetail,
  PublicBlogPostListResponse,
} from "@hu/types";
import { BLOG_POST_STATUSES } from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { evaluateLifecycleSafety } from "../lifecycle-safety/lifecycle-safety.service.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
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
} from "./blog-publication-notifications.js";
import {
  canArchiveAny,
  canCreateBlogDraft,
  canDirectPublish,
  canEditOthersDrafts,
  canEditorialPublish,
  canManageAuthorGrants,
  canRestoreArchived,
  canReviewAuthorApplications,
  resolveBlogCapabilities,
} from "./blog-permissions.js";
import { resolveBlogPublicAuthor } from "./blog-author-identity.js";
import { listBlogCategories } from "./blog-categories.js";
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
  listPublishedBlogPosts,
  listPublishedBlogPostsForSearch,
  replaceBlogAuthorApplication,
  replaceBlogPost,
  upsertBlogCapabilityGrant,
} from "./persistence/blog.repository.js";

export { listBlogCategories, listPublishedBlogPostsForSearch };

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
        "status must be one of: draft, submitted_for_review, published, archived.",
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

  const fields = validateCreateBlogDraftInput(input.body);
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

  if (existing.status === "submitted_for_review") {
    throw new BlogConflictError(
      "Posts under review cannot be edited. Withdraw to draft or wait for editorial feedback.",
    );
  }

  if (existing.status === "archived") {
    throw new BlogConflictError("Archived posts cannot be edited.");
  }

  const patch = validateUpdateBlogDraftInput(input.body);
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
  if (existing.status === "draft" && patch.title && patch.title !== existing.title) {
    nextSlug = await allocateUniqueSlug(patch.title, existing.postId);
  }

  const now = new Date().toISOString();
  let publishedVersion = existing.publishedVersion;

  if (existing.status === "published") {
    if (
      !canDirectPublish(capabilities) &&
      existing.authorParticipantId === input.actorParticipantId &&
      !capabilities.has("trusted_author")
    ) {
      throw new BlogAccessDeniedError("Only Trusted Authors, Editors, or Administrators may update published posts.");
    }
    publishedVersion = existing.publishedVersion + 1;
  }

  const updated: BlogPost = {
    ...existing,
    title: nextTitle,
    slug: nextSlug,
    excerpt: nextExcerpt,
    content: nextContent,
    categoryId: patch.categoryId ?? existing.categoryId,
    tags: patch.tags ?? existing.tags,
    coverMedia: patch.coverMedia !== undefined ? patch.coverMedia : existing.coverMedia,
    originalLanguage: patch.originalLanguage ?? existing.originalLanguage,
    safetyOutcome: safety.outcome,
    publishedVersion,
    updatedAt: now,
  };

  await replaceBlogPost(updated);

  if (updated.status === "published") {
    invalidateGlobalSearchIndex();
    await emitBlogPostPublished({
      postId: updated.postId,
      authorParticipantId: updated.authorParticipantId,
      publishedByParticipantId: input.actorParticipantId,
      publishedVersion: updated.publishedVersion,
      slug: updated.slug,
    });
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

  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  if (existing.authorParticipantId !== input.actorParticipantId && !canEditorialPublish(capabilities)) {
    throw new BlogAccessDeniedError();
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
}): Promise<BlogPost> {
  const { existing, actorParticipantId, capabilities } = input;
  assertExpectedUpdatedAt(existing, input.expectedUpdatedAt);
  requirePublishableContent(existing);

  const isOwner = existing.authorParticipantId === actorParticipantId;
  const fromDraft = existing.status === "draft";
  const fromSubmitted = existing.status === "submitted_for_review";
  const fromArchived = existing.status === "archived";

  if (fromArchived) {
    if (!canRestoreArchived(capabilities)) {
      throw new BlogAccessDeniedError("Only Administrators may restore archived Blog posts.");
    }
  } else if (fromDraft) {
    if (!isOwner && !canEditorialPublish(capabilities)) {
      throw new BlogAccessDeniedError();
    }
    if (isOwner && !canDirectPublish(capabilities)) {
      throw new BlogAccessDeniedError(
        "Standard Authors must submit for review; direct publish requires Trusted Author, Editor, or Administrator.",
      );
    }
  } else if (fromSubmitted) {
    if (!canEditorialPublish(capabilities) && !(isOwner && canDirectPublish(capabilities))) {
      if (!(isOwner && capabilities.has("trusted_author"))) {
        throw new BlogAccessDeniedError("Editor capability is required to publish submitted posts.");
      }
    }
  } else {
    throw new BlogConflictError(`Cannot publish from status ${existing.status}.`);
  }

  assertBlogStatusTransition(existing.status, "published");

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

  const now = new Date().toISOString();
  const nextVersion =
    existing.publishedVersion > 0 ? existing.publishedVersion + 1 : 1;
  const historyAction = input.allowNeedsReviewOverride
    ? "published_after_safety_review"
    : "approved_published";

  const updated: BlogPost = {
    ...existing,
    status: "published",
    safetyOutcome: safety.outcome,
    review: {
      reviewStatus: "approved",
      reviewedByParticipantId: actorParticipantId,
      reviewedAt: now,
      reviewNote: overrideNote,
    },
    publishedVersion: nextVersion,
    publishedAt: existing.publishedAt ?? now,
    publishedByParticipantId: actorParticipantId,
    archivedAt: undefined,
    archivedByParticipantId: undefined,
    updatedAt: now,
    editorialHistory: appendEditorialHistory(
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
    ),
  };

  await replaceBlogPost(updated);
  invalidateGlobalSearchIndex();
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
  await emitBlogPostPublishedNotification({
    authorParticipantId: updated.authorParticipantId,
    postId: updated.postId,
  });

  // Admin Foundation Pack 02 — append-only audit (best-effort; does not alter publish behavior).
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

  return updated;
}

export async function publishBlogPost(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
  expectedUpdatedAt?: string;
  reviewNote?: string;
}): Promise<BlogAuthorWorkspacePost> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  const existing = await findBlogPostById(input.postId);
  if (!existing) {
    throw new BlogNotFoundError();
  }

  const published = await publishBlogPostInternal({
    existing,
    actorParticipantId: input.actorParticipantId,
    capabilities,
    expectedUpdatedAt: input.expectedUpdatedAt,
    reviewNote: input.reviewNote,
  });

  return toBlogAuthorWorkspacePost(published);
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

  return {
    ...toBlogAuthorWorkspacePost(post),
    authorParticipantId: post.authorParticipantId,
    authorDisplayName: author.displayName,
  };
}

export async function listPublicBlogPosts(input: {
  limit?: number;
  offset?: number;
  categoryId?: string;
  q?: string;
}): Promise<PublicBlogPostListResponse> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  let categoryId: BlogPost["categoryId"] | undefined;
  if (input.categoryId) {
    const { isBlogCategoryId } = await import("./blog-categories.js");
    if (!isBlogCategoryId(input.categoryId)) {
      throw new BlogValidationError("Invalid categoryId filter.");
    }
    categoryId = input.categoryId;
  }

  const { items, total } = await listPublishedBlogPosts({
    limit,
    offset,
    categoryId,
    q: input.q,
  });

  const { countVisibleBlogCommentsByPostIds } = await import(
    "./persistence/blog-comment.repository.js"
  );
  const commentCounts = await countVisibleBlogCommentsByPostIds(items.map((post) => post.postId));

  const projected = [];
  for (const post of items) {
    const author = await resolveBlogPublicAuthor({
      authorParticipantId: post.authorParticipantId,
      authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
    });
    projected.push(
      toPublicBlogPostListItem(post, author, commentCounts.get(post.postId) ?? 0),
    );
  }

  const response: PublicBlogPostListResponse = {
    items: projected,
    total,
    limit,
    offset,
  };
  assertNoInternalBlogFields(response);
  return response;
}

export async function getPublicBlogPostBySlug(
  slug: string,
  viewerParticipantId?: string | null,
): Promise<PublicBlogPostDetail> {
  const post = await findBlogPostBySlug(slug.trim());
  if (!post || post.status !== "published") {
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
}): BlogAuthoringAccessState["presentation"] {
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

  return {
    participantId: input.participantId,
    capabilities: [...input.capabilities],
    application: input.application,
    presentation,
    canApply: !hasAuthor && !active,
    canResubmit: !hasAuthor && input.application?.status === "changes_requested",
    publishingWorkspaceHref: hasAuthor ? "/workspace/publishing" : null,
    navLabel: hasAuthor ? "Publishing" : "Become an Author",
    editorialReviewHref: isEditor ? "/workspace/editorial" : null,
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

  return toAuthoringAccessState({
    participantId: input.actorParticipantId,
    capabilities,
    application,
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
}): Promise<BlogCapabilityGrant> {
  return upsertBlogCapabilityGrant({
    participantId: input.participantId,
    capabilities: input.capabilities,
    updatedAt: new Date().toISOString(),
    grantedByParticipantId: "system-test",
  });
}
