/**
 * Commits never-published draft deletion and its dependent-row cleanup together.
 * Production uses the shared runMongoTransaction helper. The test memory store
 * snapshots and restores the same rows because it cannot start a Mongo session.
 * Audit and search invalidation stay outside this callback.
 */
import type {
  BlogComment,
  BlogPost,
  BlogPublicationDeliveryRecord,
  BlogReaction,
  AdministrationAuditAppendInput,
  TranslatedContentRecord,
} from "@hu/types";
import type { ClientSession } from "mongodb";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { articleDeliveryReferencesBlogPost } from "../external-author-link/external-author-link.article-ingest.repository.js";
import {
  MongoTransactionUnavailableError,
  runMongoTransaction,
} from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  snapshotContentTranslationMemory,
  restoreContentTranslationMemory,
} from "../language/persistence/content-translation.memory.store.js";
import { isIntegrityLinkedBlogPost, isNeverPublishedDraftEligible } from "./blog-draft-discard.js";
import { BlogAccessDeniedError, BlogConflictError, BlogNotFoundError } from "./blog.errors.js";
import {
  deleteBlogCommentsByPostIds,
  restoreBlogCommentsMemory,
  snapshotBlogCommentsMemory,
} from "./persistence/blog-comment.repository.js";
import {
  deleteBlogPublicationDeliveriesByPostIds,
  restoreBlogPublicationDeliveriesMemory,
  snapshotBlogPublicationDeliveriesMemory,
} from "./persistence/blog-publication-delivery.repository.js";
import {
  deleteBlogReactionsByPostIds,
  restoreBlogReactionsMemory,
  snapshotBlogReactionsMemory,
} from "./persistence/blog-reaction.repository.js";
import { deleteBlogPostContentTranslations } from "../language/persistence/content-translation.repository.js";
import {
  deleteNeverPublishedOwnedDraft,
  findBlogPostById,
  isBlogMemoryPersistenceEnabled,
  restoreBlogMemoryPosts,
  snapshotBlogMemoryPosts,
} from "./persistence/blog.repository.js";

const DRAFT_DISCARD_CONFLICT = "Only an unpublished draft can be deleted.";
const DRAFT_CHANGED_CONFLICT = "This draft changed and was not deleted.";
const INTEGRITY_CONFLICT =
  "This draft is linked to Integrity Media and cannot be deleted from Publishing.";
const BLOCKED_CONFLICT =
  "This publication is blocked by an administrator and cannot be deleted or archived by the Author.";

export type DraftDiscardCleanupStep = "comments" | "reactions" | "deliveries" | "translations";

type DraftDiscardFailure = DraftDiscardCleanupStep | "commit" | "unavailable";

const testControls: {
  failure: DraftDiscardFailure | null;
  auditAttempts: number;
  auditError: Error | null;
  beforeDelete: (() => Promise<void>) | null;
  afterDelete: (() => Promise<void>) | null;
  callbackError: Error | null;
} = {
  failure: null,
  auditAttempts: 0,
  auditError: null,
  beforeDelete: null,
  afterDelete: null,
  callbackError: null,
};

function assertDraftDiscardTestControls(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Draft discard test controls are available only when NODE_TEST_ENV=true.");
  }
}

export function setDraftDiscardFailureForTests(failure: DraftDiscardFailure | null): void {
  assertDraftDiscardTestControls();
  testControls.failure = failure;
}

export function setDraftDiscardAuditFailureForTests(error: Error | null): void {
  assertDraftDiscardTestControls();
  testControls.auditError = error;
  testControls.auditAttempts = 0;
}

export function draftDiscardAuditAttemptsForTests(): number {
  assertDraftDiscardTestControls();
  return testControls.auditAttempts;
}

export function setDraftDiscardBeforeDeleteForTests(
  barrier: (() => Promise<void>) | null,
): void {
  assertDraftDiscardTestControls();
  testControls.beforeDelete = barrier;
}

export function setDraftDiscardAfterDeleteForTests(
  barrier: (() => Promise<void>) | null,
): void {
  assertDraftDiscardTestControls();
  testControls.afterDelete = barrier;
}

/** Consumed once, inside the transaction callback, so driver retries can be observed. */
export function setDraftDiscardCallbackErrorForTests(error: Error | null): void {
  assertDraftDiscardTestControls();
  testControls.callbackError = error;
}

export function recordDraftDiscardedAfterCommit(input: AdministrationAuditAppendInput): void {
  if (process.env.NODE_TEST_ENV === "true") {
    testControls.auditAttempts += 1;
    if (testControls.auditError) {
      throw testControls.auditError;
    }
  }
  recordAdministrationAuditBestEffort(input);
}

type DraftDiscardMemorySnapshot = {
  posts: BlogPost[];
  comments: BlogComment[];
  reactions: BlogReaction[];
  deliveries: BlogPublicationDeliveryRecord[];
  translations: TranslatedContentRecord[];
};

function captureDraftDiscardMemory(): DraftDiscardMemorySnapshot {
  return {
    posts: snapshotBlogMemoryPosts(),
    comments: snapshotBlogCommentsMemory(),
    reactions: snapshotBlogReactionsMemory(),
    deliveries: snapshotBlogPublicationDeliveriesMemory(),
    translations: snapshotContentTranslationMemory(),
  };
}

function restoreDraftDiscardMemory(snapshot: DraftDiscardMemorySnapshot): void {
  restoreBlogMemoryPosts(snapshot.posts);
  restoreBlogCommentsMemory(snapshot.comments);
  restoreBlogReactionsMemory(snapshot.reactions);
  restoreBlogPublicationDeliveriesMemory(snapshot.deliveries);
  restoreContentTranslationMemory(snapshot.translations);
}

function throwIfCleanupStep(step: DraftDiscardCleanupStep): void {
  if (process.env.NODE_TEST_ENV === "true" && testControls.failure === step) {
    throw new Error(`Draft discard cleanup failed during ${step}.`);
  }
}

async function discardUnpublishedDraftInTransaction(
  input: {
    postId: string;
    authorParticipantId: string;
    expectedUpdatedAt: string;
  },
  session?: ClientSession,
): Promise<{ postId: string }> {
  if (process.env.NODE_TEST_ENV === "true" && testControls.callbackError) {
    const error = testControls.callbackError;
    testControls.callbackError = null;
    throw error;
  }
  const current = await findBlogPostById(input.postId, { session });
  if (!current || current.authorParticipantId !== input.authorParticipantId) {
    throw new BlogNotFoundError();
  }
  if (current.administrativelyBlocked === true) {
    throw new BlogAccessDeniedError(BLOCKED_CONFLICT);
  }
  if (
    isIntegrityLinkedBlogPost(current) ||
    (await articleDeliveryReferencesBlogPost(current.postId, { session }))
  ) {
    throw new BlogConflictError(INTEGRITY_CONFLICT);
  }
  if (!isNeverPublishedDraftEligible(current)) {
    throw new BlogConflictError(DRAFT_DISCARD_CONFLICT);
  }
  if (current.updatedAt !== input.expectedUpdatedAt) {
    throw new BlogConflictError(DRAFT_CHANGED_CONFLICT);
  }

  if (process.env.NODE_TEST_ENV === "true" && testControls.beforeDelete) {
    await testControls.beforeDelete();
  }

  const deleted = await deleteNeverPublishedOwnedDraft({
    postId: input.postId,
    authorParticipantId: input.authorParticipantId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    session,
  });
  if (process.env.NODE_TEST_ENV === "true" && testControls.afterDelete) {
    await testControls.afterDelete();
  }

  if (!deleted) {
    const raced = await findBlogPostById(input.postId, { session });
    if (!raced || raced.authorParticipantId !== input.authorParticipantId) {
      throw new BlogNotFoundError();
    }
    throw new BlogConflictError(DRAFT_CHANGED_CONFLICT);
  }

  const postIds = [input.postId];
  const cleanup = session ? { session } : undefined;
  throwIfCleanupStep("comments");
  await deleteBlogCommentsByPostIds(postIds, cleanup);
  throwIfCleanupStep("reactions");
  await deleteBlogReactionsByPostIds(postIds, cleanup);
  throwIfCleanupStep("deliveries");
  await deleteBlogPublicationDeliveriesByPostIds(postIds, cleanup);
  throwIfCleanupStep("translations");
  await deleteBlogPostContentTranslations(postIds, cleanup);

  if (process.env.NODE_TEST_ENV === "true" && testControls.failure === "commit") {
    throw new Error("Mongo transaction aborted before commit.");
  }
  return { postId: input.postId };
}

export async function commitUnpublishedDraftDiscard(input: {
  postId: string;
  authorParticipantId: string;
  expectedUpdatedAt: string;
}): Promise<{ postId: string }> {
  if (process.env.NODE_TEST_ENV === "true" && testControls.failure === "unavailable") {
    throw new MongoTransactionUnavailableError();
  }

  if (isBlogMemoryPersistenceEnabled()) {
    const snapshot = captureDraftDiscardMemory();
    try {
      return await discardUnpublishedDraftInTransaction(input);
    } catch (error) {
      restoreDraftDiscardMemory(snapshot);
      throw error;
    }
  }

  return runMongoTransaction((session) => discardUnpublishedDraftInTransaction(input, session));
}
