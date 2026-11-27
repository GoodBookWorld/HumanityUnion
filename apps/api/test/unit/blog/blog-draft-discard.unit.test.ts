/**
 * HU-UX-01C — never-published draft discard. No production database writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogPost } from "@hu/types";

import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogNotFoundError,
} from "../../../src/modules/blog/blog.errors.js";
import { canTransitionBlogStatus } from "../../../src/modules/blog/blog-status-transitions.js";
import { isBlogPostPubliclyDeliverable } from "../../../src/modules/blog/blog-publication-delivery.service.js";
import { buildBlogPostTranslatableSource } from "../../../src/modules/language/content-translation-blog-source.js";
import {
  archiveBlogPost,
  discardUnpublishedBlogDraft,
  grantBlogCapabilitiesForTests,
} from "../../../src/modules/blog/blog.service.js";
import {
  draftDiscardAuditAttemptsForTests,
  setDraftDiscardAuditFailureForTests,
  setDraftDiscardFailureForTests,
  type DraftDiscardCleanupStep,
} from "../../../src/modules/blog/blog-draft-discard-commit.js";
import { MongoTransactionUnavailableError } from "../../../src/infrastructure/mongodb/mongo-transaction.js";
import {
  deleteNeverPublishedOwnedDraft,
  findBlogPostById,
  insertBlogPost,
  replaceBlogPost,
  resetBlogMemoryPersistenceForTests,
  upsertBlogCapabilityGrant,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  getMediaRecordById,
  resetMediaUploadMemoryStoreForTests,
  saveMediaRecord,
} from "../../../src/modules/media-upload/media-upload.service.js";
import {
  insertArticleDelivery,
  resetArticleDeliveriesForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import {
  countVisibleBlogComments,
  insertBlogComment,
  resetBlogCommentsMemoryForTests,
} from "../../../src/modules/blog/persistence/blog-comment.repository.js";
import {
  claimBlogPublicationDelivery,
  findBlogPublicationDelivery,
  resetBlogPublicationDeliveriesForTests,
} from "../../../src/modules/blog/persistence/blog-publication-delivery.repository.js";
import {
  getBlogReactionSummary,
  resetBlogReactionsMemoryForTests,
  setBlogReaction,
} from "../../../src/modules/blog/persistence/blog-reaction.repository.js";
import {
  listContentTranslationsForSource,
  upsertContentTranslation,
} from "../../../src/modules/language/persistence/content-translation.repository.js";
import { resetContentTranslationMemoryStoreForTests } from "../../../src/modules/language/persistence/content-translation.memory.store.js";

const OWNER = "member-draft-owner";
const OTHER = "member-draft-other";

function draft(overrides: Partial<BlogPost> = {}): BlogPost {
  const now = "2026-11-26T00:00:00.000Z";
  return {
    postId: "blog-draft-1",
    authorParticipantId: OWNER,
    authorDisplayNameSnapshot: "Author",
    title: "Unpublished draft",
    slug: "unpublished-draft",
    excerpt: "Excerpt",
    content: "<p>Draft</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: null,
    status: "draft",
    originalLanguage: "en",
    safetyOutcome: null,
    review: { reviewStatus: "none" },
    publishedVersion: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function asAuthor(): Promise<void> {
  await grantBlogCapabilitiesForTests({ participantId: OWNER, capabilities: ["author"] });
  await grantBlogCapabilitiesForTests({ participantId: OTHER, capabilities: ["author"] });
}

describe("HU-UX-01C unpublished draft discard", () => {
  beforeEach(() => {
    resetBlogMemoryPersistenceForTests();
    resetMediaUploadMemoryStoreForTests();
  });

  afterEach(() => {
    resetBlogMemoryPersistenceForTests();
  });

  it("lets the owner delete a never-published draft and rejects everyone else", async () => {
    await asAuthor();
    const post = draft();
    await insertBlogPost(post);
    await insertBlogPost(draft({ postId: "blog-draft-keep", slug: "keep", title: "Keep" }));

    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.ok(await findBlogPostById("blog-draft-keep"));

    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: "blog-draft-keep",
          actorParticipantId: OTHER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogNotFoundError,
    );
    assert.ok(await findBlogPostById("blog-draft-keep"));
  });

  it("rejects blocked, published, correction, review, scheduled, and archived posts", async () => {
    await asAuthor();
    const cases: Array<Partial<BlogPost>> = [
      { postId: "blocked", administrativelyBlocked: true },
      { postId: "published", status: "published", publishedVersion: 1 },
      { postId: "correction", status: "draft", publishedVersion: 2 },
      {
        postId: "history",
        editorialHistory: [
          {
            at: "2026-11-26T00:00:00.000Z",
            actorParticipantId: OWNER,
            action: "correction_started",
            publishedVersion: 1,
          },
        ],
      },
      { postId: "review", status: "submitted_for_review" },
      { postId: "scheduled", status: "scheduled" },
      { postId: "archived", status: "archived", publishedVersion: 1 },
    ];

    for (const item of cases) {
      const post = draft(item);
      await insertBlogPost(post);
      await assert.rejects(
        () =>
          discardUnpublishedBlogDraft({
            postId: post.postId,
            actorParticipantId: OWNER,
            expectedUpdatedAt: post.updatedAt,
          }),
        item.administrativelyBlocked ? BlogAccessDeniedError : BlogConflictError,
      );
      assert.equal((await findBlogPostById(post.postId))?.postId, post.postId);
    }

    await upsertBlogCapabilityGrant({
      participantId: OWNER,
      capabilities: ["author"],
      updatedAt: "2026-11-26T00:00:00.000Z",
      administrativelyBlocked: true,
    });
    const blockedAuthor = draft({ postId: "blocked-author" });
    await insertBlogPost(blockedAuthor);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: blockedAuthor.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: blockedAuthor.updatedAt,
        }),
      BlogAccessDeniedError,
    );
    assert.ok(await findBlogPostById(blockedAuthor.postId));
  });

  it("does not delete when publication history is missing or the draft changes", async () => {
    await asAuthor();
    const ambiguous = draft({ postId: "ambiguous" });
    delete (ambiguous as { publishedVersion?: number }).publishedVersion;
    await insertBlogPost(ambiguous);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: ambiguous.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: ambiguous.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(ambiguous.postId));
    assert.equal(
      await deleteNeverPublishedOwnedDraft({
        postId: ambiguous.postId,
        authorParticipantId: OWNER,
        expectedUpdatedAt: ambiguous.updatedAt,
      }),
      false,
    );

    const fresh = draft({ postId: "race" });
    await insertBlogPost(fresh);
    await replaceBlogPost({ ...fresh, status: "published", publishedVersion: 1, updatedAt: "2026-11-26T01:00:00.000Z" });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: fresh.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: fresh.updatedAt,
        }),
      BlogConflictError,
    );
    assert.equal((await findBlogPostById(fresh.postId))?.status, "published");

    const gone = draft({ postId: "gone" });
    await insertBlogPost(gone);
    await discardUnpublishedBlogDraft({
      postId: gone.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: gone.updatedAt,
    });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: gone.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: gone.updatedAt,
        }),
      BlogNotFoundError,
    );
  });

  it("keeps shared media and refuses an Integrity-linked draft", async () => {
    await asAuthor();
    saveMediaRecord({
      mediaId: "media-cover",
      mediaUrl: "/media/cover.jpg",
      mediaType: "image/jpeg",
      size: 10,
      createdAt: "2026-11-26T00:00:00.000Z",
      ownerUserId: "user-1",
      ownerParticipantId: OWNER,
      purpose: "blog-image",
      storageKey: "covers/cover.jpg",
    });
    const post = draft({
      postId: "with-cover",
      coverMedia: { mediaId: "media-cover", mediaUrl: "/media/cover.jpg" },
    });
    await insertBlogPost(post);
    await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.equal(getMediaRecordById("media-cover")?.storageKey, "covers/cover.jpg");

    const linked = draft({
      postId: "linked",
      externalCover: { source: "integrity-media", url: "https://integrity.example/cover.jpg" },
    });
    await insertBlogPost(linked);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: linked.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: linked.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(linked.postId));

    resetArticleDeliveriesForTests();
    const referenced = draft({ postId: "delivery-ref" });
    await insertBlogPost(referenced);
    await insertArticleDelivery({
      source: "integrity-media",
      publicationId: "im-publication-1",
      payloadDigest: "digest",
      postId: referenced.postId,
      status: "draft",
      phase: "complete",
      createdAt: referenced.createdAt,
      updatedAt: referenced.updatedAt,
    });
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: referenced.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: referenced.updatedAt,
        }),
      BlogConflictError,
    );
    assert.ok(await findBlogPostById(referenced.postId));
  });

  it("leaves published archive transitions unchanged and requires authentication on the new route", () => {
    assert.equal(canTransitionBlogStatus("published", "archived"), true);
    assert.equal(canTransitionBlogStatus("draft", "archived"), false);
    assert.equal(canTransitionBlogStatus("scheduled", "archived"), true);
    assert.equal(canTransitionBlogStatus("submitted_for_review", "archived"), false);

    const service = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog.service.ts"),
      "utf8",
    );
    const archive = service.slice(service.indexOf("export async function archiveBlogPost"), service.indexOf("export async function listEditorialReviewQueue"));
    assert.match(archive, /assertBlogStatusTransition\(existing\.status, "archived"\)/);
    assert.doesNotMatch(archive, /deleteNeverPublishedOwnedDraft/);

    const routes = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog.routes.ts"),
      "utf8",
    );
    const discardRoute = routes.slice(routes.indexOf('"/posts/:postId/discard-draft"'), routes.indexOf('"/posts/:postId/start-correction"'));
    assert.match(discardRoute, /requireJwtAuthenticationMiddleware/);
    assert.match(discardRoute, /discardUnpublishedBlogDraft/);
    assert.match(routes, /\/posts\/:postId\/archive", requireJwtAuthenticationMiddleware/);
    assert.match(routes, /archiveBlogPost\(/);
  });

  it("still rejects archive of a draft through the published deletion path", async () => {
    await asAuthor();
    const post = draft({ postId: "archive-draft" });
    await insertBlogPost(post);
    await assert.rejects(
      () => archiveBlogPost({ postId: post.postId, actorParticipantId: OWNER }),
      /Invalid Blog status transition: draft → archived/,
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
  });
});

describe("HU-UX-01F.1 atomic unpublished draft discard", () => {
  const storedAt = "2026-11-26T00:00:00.000Z";

  beforeEach(async () => {
    resetBlogMemoryPersistenceForTests();
    resetBlogCommentsMemoryForTests();
    resetBlogReactionsMemoryForTests();
    resetBlogPublicationDeliveriesForTests();
    resetContentTranslationMemoryStoreForTests();
    resetMediaUploadMemoryStoreForTests();
    resetArticleDeliveriesForTests();
    setDraftDiscardFailureForTests(null);
    setDraftDiscardAuditFailureForTests(null);
    await asAuthor();
  });

  afterEach(() => {
    setDraftDiscardFailureForTests(null);
    setDraftDiscardAuditFailureForTests(null);
  });

  async function seedDependents(postId: string): Promise<void> {
    await insertBlogComment({
      commentId: `comment-${postId}`,
      postId,
      authorParticipantId: OTHER,
      authorDisplayNameSnapshot: "Reader",
      content: "A comment on the draft.",
      status: "visible",
      moderationState: "none",
      safetyOutcome: null,
      createdAt: storedAt,
      updatedAt: storedAt,
    });
    await setBlogReaction({ postId, actorParticipantId: `reader-${postId}`, reaction: "helpful" });
    await claimBlogPublicationDelivery({ postId, subscriberId: "subscriber-1", maxAttempts: 3 });
    await upsertContentTranslation({
      translationId: `tr-${postId}`,
      sourceKind: "blog_post",
      sourceRecordId: postId,
      sourceVersion: "1",
      sourceLanguage: "en",
      targetLanguage: "es",
      translatedContent: "texto",
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: storedAt,
      stale: false,
      freshness: "current",
    });
    await upsertContentTranslation({
      translationId: `tr-other-${postId}`,
      sourceKind: "discussion_comment",
      sourceRecordId: postId,
      sourceVersion: "1",
      sourceLanguage: "en",
      targetLanguage: "es",
      translatedContent: "otro",
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: storedAt,
      stale: false,
      freshness: "current",
    });
  }

  async function assertDependentsPresent(postId: string): Promise<void> {
    assert.equal(await countVisibleBlogComments(postId), 1);
    assert.equal((await getBlogReactionSummary({ postId })).helpful, 1);
    assert.ok(await findBlogPublicationDelivery(postId, "subscriber-1"));
    const blogTranslations = await listContentTranslationsForSource({
      sourceKind: "blog_post",
      sourceRecordId: postId,
    });
    assert.equal(blogTranslations.length, 1);
  }

  it("commits deletion and cleanup together and preserves unrelated rows and media", async () => {
    const post = draft({ postId: "atomic-draft", slug: "atomic-draft" });
    const other = draft({ postId: "other-draft", slug: "other-draft" });
    await insertBlogPost(post);
    await insertBlogPost(other);
    await seedDependents(post.postId);
    await seedDependents(other.postId);
    saveMediaRecord({
      mediaId: "media-atomic",
      mediaUrl: "/media/atomic.jpg",
      mediaType: "image/jpeg",
      size: 10,
      createdAt: storedAt,
      ownerUserId: "user-1",
      ownerParticipantId: OWNER,
      purpose: "blog-image",
      storageKey: "covers/atomic.jpg",
    });

    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });

    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.equal(await countVisibleBlogComments(post.postId), 0);
    assert.equal((await getBlogReactionSummary({ postId: post.postId })).helpful, 0);
    assert.equal(await findBlogPublicationDelivery(post.postId, "subscriber-1"), null);
    assert.deepEqual(
      await listContentTranslationsForSource({
        sourceKind: "blog_post",
        sourceRecordId: post.postId,
      }),
      [],
    );
    const unrelatedTranslation = await listContentTranslationsForSource({
      sourceKind: "discussion_comment",
      sourceRecordId: post.postId,
    });
    assert.equal(unrelatedTranslation.length, 1);
    await assertDependentsPresent(other.postId);
    assert.ok(await findBlogPostById(other.postId));
    assert.equal(getMediaRecordById("media-atomic")?.storageKey, "covers/atomic.jpg");
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  for (const step of ["comments", "reactions", "deliveries", "translations"] as const) {
    it(`restores the draft and dependents when ${step} cleanup fails`, async () => {
      const post = draft({ postId: `fail-${step}`, slug: `fail-${step}` });
      await insertBlogPost(post);
      await seedDependents(post.postId);
      setDraftDiscardFailureForTests(step satisfies DraftDiscardCleanupStep);

      await assert.rejects(
        () =>
          discardUnpublishedBlogDraft({
            postId: post.postId,
            actorParticipantId: OWNER,
            expectedUpdatedAt: post.updatedAt,
          }),
        new RegExp(step),
      );

      assert.equal((await findBlogPostById(post.postId))?.status, "draft");
      await assertDependentsPresent(post.postId);
      assert.equal(draftDiscardAuditAttemptsForTests(), 0);
    });
  }

  it("does not delete when a transaction cannot start", async () => {
    const post = draft({ postId: "unavailable", slug: "unavailable" });
    await insertBlogPost(post);
    await seedDependents(post.postId);
    setDraftDiscardFailureForTests("unavailable");

    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      MongoTransactionUnavailableError,
    );

    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
    await assertDependentsPresent(post.postId);
    assert.equal(draftDiscardAuditAttemptsForTests(), 0);
  });

  it("restores every discarded row when commit aborts and succeeds on a later attempt", async () => {
    const post = draft({ postId: "retry-draft", slug: "retry-draft" });
    await insertBlogPost(post);
    await seedDependents(post.postId);
    setDraftDiscardFailureForTests("commit");

    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      /aborted before commit/,
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
    await assertDependentsPresent(post.postId);
    assert.equal(draftDiscardAuditAttemptsForTests(), 0);

    setDraftDiscardFailureForTests(null);
    const retried = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(retried, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.equal(await countVisibleBlogComments(post.postId), 0);
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  it("keeps a concurrently published post and does not record a deletion", async () => {
    const post = draft({ postId: "published-race", slug: "published-race" });
    await insertBlogPost(post);
    await replaceBlogPost({
      ...post,
      status: "published",
      publishedVersion: 1,
      updatedAt: "2026-11-26T02:00:00.000Z",
    });

    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogConflictError,
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "published");
    assert.equal((await findBlogPostById(post.postId))?.publishedVersion, 1);
    assert.equal(draftDiscardAuditAttemptsForTests(), 0);
  });

  it("does not accept comments, reactions, or deliveries for an eligible draft", async () => {
    const post = draft({ postId: "no-dependents", slug: "no-dependents" });
    await insertBlogPost(post);
    assert.equal(isBlogPostPubliclyDeliverable(post), false);
    assert.equal(buildBlogPostTranslatableSource(post).isPublished, false);
    const interaction = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../src/modules/blog/blog-interaction.service.ts",
      ),
      "utf8",
    );
    const publishedGate = interaction.slice(
      interaction.indexOf("async function requirePublishedPostBySlug"),
      interaction.indexOf("async function requirePublishedPostById"),
    );
    assert.match(publishedGate, /post\.status !== "published"/);
    assert.match(interaction, /const post = await requirePublishedPostBySlug\(input\.slug\);/);
    assert.equal(await countVisibleBlogComments(post.postId), 0);
    assert.equal((await getBlogReactionSummary({ postId: post.postId })).helpful, 0);
    assert.equal(await findBlogPublicationDelivery(post.postId, "subscriber-1"), null);
  });

  it("reports success when the audit fails after the deletion has committed", async () => {
    const post = draft({ postId: "audit-after", slug: "audit-after" });
    await insertBlogPost(post);
    await seedDependents(post.postId);
    setDraftDiscardAuditFailureForTests(new Error("audit store unavailable"));

    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });

    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.equal(await countVisibleBlogComments(post.postId), 0);
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  it("uses the shared transaction helper and leaves published archive deletion unchanged", () => {
    const commit = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog-draft-discard-commit.ts"),
      "utf8",
    );
    const service = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../src/modules/blog/blog.service.ts"),
      "utf8",
    );
    const transaction = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../src/infrastructure/mongodb/mongo-transaction.ts",
      ),
      "utf8",
    );
    assert.match(commit, /runMongoTransaction\(\(session\) => discardUnpublishedDraftInTransaction\(input, session\)\)/);
    assert.match(commit, /deleteNeverPublishedOwnedDraft\([\s\S]*session,/);
    assert.match(commit, /deleteBlogCommentsByPostIds\(postIds, cleanup\)/);
    assert.match(commit, /deleteBlogReactionsByPostIds\(postIds, cleanup\)/);
    assert.match(commit, /deleteBlogPublicationDeliveriesByPostIds\(postIds, cleanup\)/);
    assert.match(commit, /deleteBlogPostContentTranslations\(postIds, cleanup\)/);
    assert.equal(commit.includes("invalidateGlobalSearchIndex"), false);
    assert.equal(commit.includes("recordAdministrationAuditBestEffort"), true);
    assert.match(transaction, /session\.withTransaction\(async \(\) => \{/);
    const discard = service.slice(
      service.indexOf("export async function discardUnpublishedBlogDraft"),
      service.indexOf("export async function archiveBlogPost"),
    );
    assert.match(discard, /await commitUnpublishedDraftDiscard/);
    assert.match(discard, /recordDraftDiscardedAfterCommit/);
    assert.equal(discard.includes("deleteNeverPublishedOwnedDraft"), false);
    const archive = service.slice(
      service.indexOf("export async function archiveBlogPost"),
      service.indexOf("export async function listEditorialReviewQueue"),
    );
    assert.match(archive, /assertBlogStatusTransition\(existing\.status, "archived"\)/);
    assert.equal(archive.includes("commitUnpublishedDraftDiscard"), false);
    assert.equal(archive.includes("deleteNeverPublishedOwnedDraft"), false);
  });
});
