/**
 * HU-UX-01F.2 — draft discard on an isolated single-node replica set.
 * The database is hu_test_* on 127.0.0.1. Production is not contacted.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { BlogPost } from "@hu/types";
import { MongoServerError } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

import {
  assertExplicitIsolatedMongoTestTarget,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection, getMongoDatabase } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { BlogConflictError, BlogNotFoundError } from "../../../src/modules/blog/blog.errors.js";
import {
  draftDiscardAuditAttemptsForTests,
  setDraftDiscardAfterDeleteForTests,
  setDraftDiscardAuditFailureForTests,
  setDraftDiscardBeforeDeleteForTests,
  setDraftDiscardCallbackErrorForTests,
  setDraftDiscardFailureForTests,
} from "../../../src/modules/blog/blog-draft-discard-commit.js";
import {
  archiveBlogPost,
  discardUnpublishedBlogDraft,
  grantBlogCapabilitiesForTests,
} from "../../../src/modules/blog/blog.service.js";
import { insertBlogComment } from "../../../src/modules/blog/persistence/blog-comment.repository.js";
import {
  claimBlogPublicationDelivery,
  findBlogPublicationDelivery,
} from "../../../src/modules/blog/persistence/blog-publication-delivery.repository.js";
import {
  getBlogReactionSummary,
  setBlogReaction,
} from "../../../src/modules/blog/persistence/blog-reaction.repository.js";
import {
  findBlogPostById,
  insertBlogPost,
  replaceBlogPost,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import { INTEGRITY_MEDIA_SOURCE } from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  ArticleDeliveryTargetMissingError,
  commitNewArticleDraftDelivery,
  insertArticleDelivery,
  setArticleDeliveryBindBarrierForTests,
  updateArticleDeliveryPhase,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import { getOrCreateContentTranslation } from "../../../src/modules/language/content-translation.service.js";
import { listContentTranslationsForSource, upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  getMediaRecordById,
  resetMediaUploadMemoryStoreForTests,
  saveMediaRecord,
} from "../../../src/modules/media-upload/media-upload.service.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_ux01f2_${RUN}`;
const OWNER = "member-mongo-draft-owner";
const NOW = "2026-11-26T00:00:00.000Z";
const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

function draft(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    postId: "mongo-draft",
    authorParticipantId: OWNER,
    authorDisplayNameSnapshot: "Author",
    title: "Unpublished draft",
    slug: "mongo-unpublished-draft",
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function capture<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

function gate() {
  let open: () => void = () => {};
  let release: () => void = () => {};
  const entered = new Promise<void>((resolve) => {
    open = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { entered, enter: open, release, released };
}

async function seedDependents(postId: string): Promise<void> {
  await insertBlogComment({
    commentId: `comment-${postId}`,
    postId,
    authorParticipantId: "member-reader",
    authorDisplayNameSnapshot: "Reader",
    content: "A comment.",
    status: "visible",
    moderationState: "none",
    safetyOutcome: null,
    createdAt: NOW,
    updatedAt: NOW,
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
    createdAt: NOW,
    stale: false,
    freshness: "current",
  });
}

async function assertDependents(postId: string, present: boolean): Promise<void> {
  const comments = await getMongoCollection(MONGO_COLLECTIONS.blogComments).countDocuments({ postId });
  const reactions = await getMongoCollection(MONGO_COLLECTIONS.blogReactions).countDocuments({ postId });
  const deliveries = await findBlogPublicationDelivery(postId, "subscriber-1");
  const translations = await listContentTranslationsForSource({
    sourceKind: "blog_post",
    sourceRecordId: postId,
  });
  if (present) {
    assert.equal(comments, 1);
    assert.equal(reactions, 1);
    assert.ok(deliveries);
    assert.equal(translations.length, 1);
    return;
  }
  assert.equal(comments, 0);
  assert.equal(reactions, 0);
  assert.equal(deliveries, null);
  assert.equal(translations.length, 0);
}

async function delivery(publicationId: string, postId: string | null) {
  await insertArticleDelivery({
    source: INTEGRITY_MEDIA_SOURCE,
    publicationId,
    authorId: "im-author",
    payloadDigest: "digest",
    postId,
    status: postId ? "draft" : null,
    phase: postId ? "held" : "creating",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe("HU-UX-01F.2 draft discard MongoDB transactions", () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
    process.env.NODE_TEST_ENV = "true";
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    assert.equal(uri.includes("mongodb+srv"), false);
    assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connectMongoClient();
    connected = true;
    assert.equal(getMongoDatabase().databaseName, DATABASE);
    await ensureMongoIndexes();
    await grantBlogCapabilitiesForTests({ participantId: OWNER, capabilities: ["author"] });
  });

  after(async () => {
    try {
      if (connected && getMongoDatabase().databaseName === DATABASE) {
        await getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  beforeEach(async () => {
    setDraftDiscardFailureForTests(null);
    setDraftDiscardAuditFailureForTests(null);
    setDraftDiscardBeforeDeleteForTests(null);
    setDraftDiscardAfterDeleteForTests(null);
    setDraftDiscardCallbackErrorForTests(null);
    setArticleDeliveryBindBarrierForTests(null);
    resetMediaUploadMemoryStoreForTests();
    for (const name of [
      MONGO_COLLECTIONS.blogPosts,
      MONGO_COLLECTIONS.blogComments,
      MONGO_COLLECTIONS.blogReactions,
      MONGO_COLLECTIONS.blogPublicationDeliveries,
      MONGO_COLLECTIONS.contentTranslations,
      MONGO_COLLECTIONS.integrityMediaArticleDeliveries,
    ]) {
      await getMongoCollection(name).deleteMany({});
    }
  });

  it("commits the draft deletion and its dependent cleanup", async () => {
    const post = draft();
    const other = draft({ postId: "other-draft", slug: "other-draft" });
    await insertBlogPost(post);
    await insertBlogPost(other);
    await seedDependents(post.postId);
    await seedDependents(other.postId);
    saveMediaRecord({
      mediaId: "media-mongo",
      mediaUrl: "/media/mongo.jpg",
      mediaType: "image/jpeg",
      size: 10,
      createdAt: NOW,
      ownerUserId: "user-1",
      ownerParticipantId: OWNER,
      purpose: "blog-image",
      storageKey: "covers/mongo.jpg",
    });

    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });

    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    await assertDependents(post.postId, false);
    await assertDependents(other.postId, true);
    assert.equal((await getBlogReactionSummary({ postId: other.postId })).helpful, 1);
    assert.equal(getMediaRecordById("media-mongo")?.storageKey, "covers/mongo.jpg");
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  for (const step of ["comments", "reactions", "deliveries", "translations"] as const) {
    it(`aborts the discard when ${step} cleanup fails`, async () => {
      const post = draft({ postId: `fail-${step}`, slug: `fail-${step}` });
      await insertBlogPost(post);
      await seedDependents(post.postId);
      setDraftDiscardFailureForTests(step);

      await assert.rejects(() =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      );

      assert.equal((await findBlogPostById(post.postId))?.status, "draft");
      await assertDependents(post.postId, true);
      assert.equal(draftDiscardAuditAttemptsForTests(), 0);
    });
  }

  it("preserves every row when the commit aborts and succeeds on the next attempt", async () => {
    const post = draft({ postId: "retry-draft", slug: "retry-draft" });
    await insertBlogPost(post);
    await seedDependents(post.postId);
    setDraftDiscardFailureForTests("commit");
    await assert.rejects(() =>
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
    await assertDependents(post.postId, true);

    setDraftDiscardFailureForTests(null);
    const retried = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(retried, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    await assertDependents(post.postId, false);
  });

  it("retries a transient transaction error once and records one audit", async () => {
    const post = draft({ postId: "transient-draft", slug: "transient-draft" });
    await insertBlogPost(post);
    setDraftDiscardCallbackErrorForTests(
      new MongoServerError({
        message: "transient",
        errorLabels: ["TransientTransactionError"],
      }),
    );
    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  it("does not commit when the callback reports an unknown commit result", async () => {
    const post = draft({ postId: "unknown-commit", slug: "unknown-commit" });
    await insertBlogPost(post);
    setDraftDiscardCallbackErrorForTests(
      new MongoServerError({
        message: "unknown",
        errorLabels: ["UnknownTransactionCommitResult"],
      }),
    );
    await assert.rejects(() =>
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "draft");
    assert.equal(draftDiscardAuditAttemptsForTests(), 0);
  });

  it("keeps a post that is published while discard is in progress", async () => {
    const post = draft({ postId: "publish-race", slug: "publish-race" });
    await insertBlogPost(post);
    const hold = gate();
    setDraftDiscardBeforeDeleteForTests(async () => {
      hold.enter();
      await hold.released;
    });
    const discardPromise = capture(
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    await hold.entered;
    await replaceBlogPost({
      ...post,
      status: "published",
      publishedVersion: 1,
      updatedAt: "2026-11-26T03:00:00.000Z",
    });
    hold.release();
    const discarded = await discardPromise;
    assert.equal(discarded.ok, false);
    assert.ok(discarded.ok === false && discarded.error instanceof BlogConflictError);
    const stored = await findBlogPostById(post.postId);
    assert.equal(stored?.status, "published");
    assert.equal(stored?.publishedVersion, 1);
    assert.equal(draftDiscardAuditAttemptsForTests(), 0);
  });

  it("keeps a draft whose update commits while discard is in progress", async () => {
    const post = draft({ postId: "update-race", slug: "update-race" });
    await insertBlogPost(post);
    const hold = gate();
    setDraftDiscardBeforeDeleteForTests(async () => {
      hold.enter();
      await hold.released;
    });
    const discardPromise = capture(
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    await hold.entered;
    await replaceBlogPost({ ...post, title: "Changed", updatedAt: "2026-11-26T04:00:00.000Z" });
    hold.release();
    const discarded = await discardPromise;
    assert.equal(discarded.ok, false);
    assert.ok(discarded.ok === false && discarded.error instanceof BlogConflictError);
    const stored = await findBlogPostById(post.postId);
    assert.equal(stored?.title, "Changed");
    assert.equal(stored?.updatedAt, "2026-11-26T04:00:00.000Z");
  });

  it("refuses discard when an article-delivery mapping is already stored", async () => {
    const post = draft({ postId: "mapped-draft", slug: "mapped-draft" });
    await insertBlogPost(post);
    await delivery("pub-mapped", post.postId);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogConflictError,
    );
    assert.equal((await findBlogPostById(post.postId))?.postId, post.postId);
    const row = await getMongoCollection(MONGO_COLLECTIONS.integrityMediaArticleDeliveries).findOne({
      publicationId: "pub-mapped",
    });
    assert.equal(row?.postId, post.postId);
  });

  it("does not leave a mapping when binding loses to discard", async () => {
    const post = draft({ postId: "bind-loses", slug: "bind-loses" });
    await insertBlogPost(post);
    await delivery("pub-bind-loses", null);
    const hold = gate();
    setDraftDiscardAfterDeleteForTests(async () => {
      hold.enter();
      await hold.released;
    });
    const discardPromise = capture(
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    await hold.entered;
    const bindPromise = capture(
      updateArticleDeliveryPhase({
        publicationId: "pub-bind-loses",
        postId: post.postId,
        status: "draft",
        phase: "held",
      }),
    );
    hold.release();
    const discarded = await discardPromise;
    const bound = await bindPromise;
    assert.equal(discarded.ok, true);
    assert.equal(bound.ok, false);
    assert.ok(bound.ok === false && bound.error instanceof ArticleDeliveryTargetMissingError);
    assert.equal(await findBlogPostById(post.postId), null);
    const row = await getMongoCollection(MONGO_COLLECTIONS.integrityMediaArticleDeliveries).findOne({
      publicationId: "pub-bind-loses",
    });
    assert.equal(row?.postId, null);
  });

  it("keeps the draft and the mapping when binding wins the race", async () => {
    const post = draft({ postId: "bind-wins", slug: "bind-wins" });
    await insertBlogPost(post);
    await delivery("pub-bind-wins", null);
    const hold = gate();
    setArticleDeliveryBindBarrierForTests(async () => {
      hold.enter();
      await hold.released;
    });
    const bindPromise = capture(
      updateArticleDeliveryPhase({
        publicationId: "pub-bind-wins",
        postId: post.postId,
        status: "draft",
        phase: "held",
      }),
    );
    await hold.entered;
    const discardPromise = capture(
      discardUnpublishedBlogDraft({
        postId: post.postId,
        actorParticipantId: OWNER,
        expectedUpdatedAt: post.updatedAt,
      }),
    );
    hold.release();
    const bound = await bindPromise;
    const discarded = await discardPromise;
    assert.equal(bound.ok, true);
    assert.equal(discarded.ok, false);
    assert.ok(discarded.ok === false && discarded.error instanceof BlogConflictError);
    assert.equal((await findBlogPostById(post.postId))?.postId, post.postId);
    const row = await getMongoCollection(MONGO_COLLECTIONS.integrityMediaArticleDeliveries).findOne({
      publicationId: "pub-bind-wins",
    });
    assert.equal(row?.postId, post.postId);
  });

  it("does not attach a mapping after the draft has been deleted", async () => {
    const post = draft({ postId: "after-delete", slug: "after-delete" });
    await insertBlogPost(post);
    await delivery("pub-after", null);
    await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    await assert.rejects(
      () =>
        updateArticleDeliveryPhase({
          publicationId: "pub-after",
          postId: post.postId,
          status: "draft",
          phase: "held",
        }),
      ArticleDeliveryTargetMissingError,
    );
    const row = await getMongoCollection(MONGO_COLLECTIONS.integrityMediaArticleDeliveries).findOne({
      publicationId: "pub-after",
    });
    assert.equal(row?.postId, null);
  });

  it("hides a new ingest draft until its delivery mapping commits", async () => {
    const post = draft({ postId: "atomic-ingest", slug: "atomic-ingest" });
    await delivery("pub-atomic", null);
    const hold = gate();
    setArticleDeliveryBindBarrierForTests(async () => {
      const visible = await getMongoCollection(MONGO_COLLECTIONS.blogPosts).findOne({
        postId: post.postId,
      });
      assert.equal(visible, null);
      hold.enter();
      await hold.released;
    });
    const commitPromise = commitNewArticleDraftDelivery({
      post,
      publicationId: "pub-atomic",
      status: "draft",
    });
    await hold.entered;
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogNotFoundError,
    );
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.blogPosts).findOne({ postId: post.postId }),
      null,
    );
    hold.release();
    assert.equal(await commitPromise, post.postId);
    assert.equal((await findBlogPostById(post.postId))?.postId, post.postId);
    const row = await getMongoCollection(MONGO_COLLECTIONS.integrityMediaArticleDeliveries).findOne({
      publicationId: "pub-atomic",
    });
    assert.equal(row?.postId, post.postId);
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: post.updatedAt,
        }),
      BlogConflictError,
    );
  });

  it("does not persist a blog translation for an unpublished draft", async () => {
    const post = draft({ postId: "untranslated", slug: "untranslated" });
    await insertBlogPost(post);
    await assert.rejects(() =>
      getOrCreateContentTranslation({
        sourceKind: "blog_post",
        sourceRecordId: post.postId,
        targetLanguage: "es",
        generateIfMissing: true,
        intent: "on_demand",
      }),
    );
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.contentTranslations).countDocuments({
        sourceKind: "blog_post",
        sourceRecordId: post.postId,
      }),
      0,
    );
  });

  it("returns success when the audit fails after the deletion commits", async () => {
    const post = draft({ postId: "audit-fail", slug: "audit-fail" });
    await insertBlogPost(post);
    setDraftDiscardAuditFailureForTests(new Error("audit store unavailable"));
    const removed = await discardUnpublishedBlogDraft({
      postId: post.postId,
      actorParticipantId: OWNER,
      expectedUpdatedAt: post.updatedAt,
    });
    assert.deepEqual(removed, { postId: post.postId });
    assert.equal(await findBlogPostById(post.postId), null);
    assert.equal(draftDiscardAuditAttemptsForTests(), 1);
  });

  it("still archives a published post and leaves that post stored", async () => {
    const post = draft({
      postId: "published-archive",
      slug: "published-archive",
      status: "published",
      publishedVersion: 1,
      publishedAt: NOW,
    });
    await insertBlogPost(post);
    const archived = await archiveBlogPost({ postId: post.postId, actorParticipantId: OWNER });
    assert.equal(archived.status, "archived");
    assert.equal((await findBlogPostById(post.postId))?.status, "archived");
    await assert.rejects(
      () =>
        discardUnpublishedBlogDraft({
          postId: post.postId,
          actorParticipantId: OWNER,
          expectedUpdatedAt: NOW,
        }),
      BlogConflictError,
    );
    assert.equal((await findBlogPostById(post.postId))?.status, "archived");
  });
});
