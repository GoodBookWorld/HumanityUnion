/**
 * Disposable local MongoDB proof for Integrity Media author-deletion cleanup.
 * This process starts its own mongod. It never uses port 27017 or the
 * hu_test_author_deletion diagnostic database.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import type { BlogPost } from "@hu/types";
import { MongoClient } from "mongodb";

import { insertBlogComment, findBlogCommentById } from "../../src/modules/blog/persistence/blog-comment.repository.js";
import {
  claimBlogPublicationDelivery,
  findBlogPublicationDelivery,
} from "../../src/modules/blog/persistence/blog-publication-delivery.repository.js";
import {
  getBlogReactionSummary,
  setBlogReaction,
} from "../../src/modules/blog/persistence/blog-reaction.repository.js";
import {
  findBlogCapabilityGrant,
  findBlogPostById,
  insertBlogPost,
  upsertBlogCapabilityGrant,
} from "../../src/modules/blog/persistence/blog.repository.js";
import { acceptIntegrityMediaAuthorDeletion } from "../../src/modules/external-author-link/external-author-link.author-deletion.js";
import {
  buildIntegrityMediaAuthorDeletionPayload,
  resetIntegrityMediaAuthorDeletionReplayCacheForTests,
  signIntegrityMediaAuthorDeletion,
} from "../../src/modules/external-author-link/external-author-link.author-deletion.hmac.js";
import { setAuthorDeletionCleanupFailureForTests } from "../../src/modules/external-author-link/external-author-link.author-deletion.cleanup.js";
import {
  findArticleDelivery,
  insertArticleDelivery,
} from "../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../src/modules/external-author-link/external-author-link.constants.js";
import { getExternalAuthorLinkStore } from "../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../src/modules/external-author-link/external-author-link.types.js";
import { getIntegrityMediaAuthorMessageStore } from "../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import {
  findContentTranslation,
  upsertContentTranslation,
} from "../../src/modules/language/persistence/content-translation.repository.js";
import { dropOwnedEphemeralDatabase } from "../../src/infrastructure/mongodb/ephemeral-mongo-database-safety.js";
import { lockExplicitIsolatedMongoTestConfig } from "../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../src/infrastructure/mongodb/mongo-collections.js";
import { connectMongoClient, getMongoClient } from "../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../src/infrastructure/mongodb/mongo-indexes.js";
import { getMongoCollection } from "../../src/infrastructure/mongodb/mongo-database.js";

const DATABASE = "hu_test_im_del_3b";
const SECRET = "hu-author-deletion-mongo-secret";
const MEMBER = "11111111-1111-4111-8111-111111111111";
const OTHER_MEMBER = "22222222-2222-4222-8222-222222222222";
const ADMIN_MEMBER = "33333333-3333-4333-8333-333333333333";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INSTANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OPERATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OPERATION_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const STORED_AT = "2026-01-01T00:00:00.000Z";
const KEPT_EMAIL = "kept-member@example.com";

if (
  DATABASE === "hu_test_author_deletion" ||
  DATABASE.includes("staging") ||
  DATABASE.includes("production")
) {
  throw new Error("Refusing to use a protected database for author-deletion cleanup.");
}

let mongod: ChildProcess | null = null;
let dbPath = "";
let mongoUri = "";

describe("Integrity Media author deletion cleanup on disposable MongoDB", () => {
  before(async () => {
    const binary = process.env.HU_DISPOSABLE_MONGOD;
    if (!binary) {
      process.exit(2);
    }
    const port = await freePort();
    if (port === 27017) {
      throw new Error("Refusing to use MongoDB port 27017.");
    }
    dbPath = mkdtempSync(join(tmpdir(), "hu-im-del-"));
    mongod = spawn(
      binary,
      [
        "--replSet",
        "rs0",
        "--bind_ip",
        "127.0.0.1",
        "--port",
        String(port),
        "--dbpath",
        dbPath,
        "--noauth",
      ],
      { stdio: "ignore" },
    );
    mongoUri = `mongodb://127.0.0.1:${port}/${DATABASE}?directConnection=true&replicaSet=rs0`;
    await waitForReplicaPrimary(mongoUri, port);
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DATABASE = DATABASE;
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV] = "true";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    lockExplicitIsolatedMongoTestConfig({ uri: mongoUri, database: DATABASE });
    await connectMongoClient();
    const names = await getMongoClient().db().admin().listDatabases();
    if (names.databases.some((entry) => entry.name === "hu_test_author_deletion")) {
      throw new Error("The diagnostic author-deletion database is visible and must not be used.");
    }
    await ensureMongoIndexes();
  });

  after(async () => {
    if (mongoUri) {
      await dropOwnedEphemeralDatabase({
        uri: mongoUri,
        databaseName: DATABASE,
        ownedDatabaseName: DATABASE,
        kind: "test",
        timeoutMs: 20_000,
      });
    }
    await closeAppClient();
    await stopMongod();
    if (dbPath) {
      rmSync(dbPath, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    setAuthorDeletionCleanupFailureForTests("off");
    resetIntegrityMediaAuthorDeletionReplayCacheForTests();
    await clearDisposableData();
  });

  it("commits proven cleanup and withholds everything else", async () => {
    await seedIdentity();
    await seedOwnershipMatrix();
    const result = await deleteAuthor(OPERATION);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.status, "completed");
    assert.equal(result.idempotent, false);
    assert.equal(result.removed.posts, 1);
    assert.equal(result.removed.articleDeliveries, 1);
    assert.equal(result.removed.links, 1);
    assert.deepEqual(
      result.withheld.map((entry) => entry.reason).sort(),
      ["author_id_case_variant", "missing_post_id", "post_missing", "post_owner_mismatch"],
    );
    const acknowledgment = JSON.stringify(result);
    assert.equal(acknowledgment.includes(KEPT_EMAIL), false);
    assert.equal(acknowledgment.includes("Kept Member"), false);
    assert.equal(acknowledgment.includes("<p>"), false);

    assert.equal(await findBlogPostById("post-proven"), null);
    assert.ok(await findBlogPostById("post-ordinary"));
    assert.ok(await findBlogPostById("post-case"));
    assert.ok(await findBlogPostById("post-mismatch"));
    assert.ok(await findBlogPostById("post-other"));
    assert.ok(await findBlogPostById("post-unowned"));
    assert.equal(await findBlogCommentById("comment-proven"), null);
    assert.ok(await findBlogCommentById("comment-ordinary"));
    assert.equal((await getBlogReactionSummary({ postId: "post-proven" })).helpful, 0);
    assert.equal((await getBlogReactionSummary({ postId: "post-ordinary" })).helpful, 1);
    assert.equal(await findBlogPublicationDelivery("post-proven", "subscriber-proven"), null);
    assert.ok(await findBlogPublicationDelivery("post-ordinary", "subscriber-ordinary"));
    assert.equal(await findArticleDelivery("pub-proven"), null);
    assert.ok(await findArticleDelivery("pub-case"));
    assert.ok(await findArticleDelivery("pub-missing-post"));
    assert.ok(await findArticleDelivery("pub-absent-post"));
    assert.ok(await findArticleDelivery("pub-mismatch"));
    assert.ok(await findArticleDelivery("pub-other"));
    assert.ok(await findArticleDelivery("pub-no-author"));
    assert.equal(
      await findContentTranslation({
        sourceKind: "blog_post",
        sourceRecordId: "post-proven",
        sourceVersion: "1",
        targetLanguage: "es",
      }),
      null,
    );
    assert.ok(
      await findContentTranslation({
        sourceKind: "discussion_comment",
        sourceRecordId: "post-proven",
        sourceVersion: "1",
        targetLanguage: "es",
      }),
    );
    assert.equal(await getMongoCollection(MONGO_COLLECTIONS.authUsers).countDocuments({ email: KEPT_EMAIL }), 1);
    assert.equal(await getMongoCollection(MONGO_COLLECTIONS.members).countDocuments({ displayName: "Kept Member" }), 1);
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.memberProfiles).countDocuments({ displayName: "Kept Profile" }),
      1,
    );
    assert.ok(await findBlogCapabilityGrant(MEMBER));
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.externalAuthorProvisionAttempts).countDocuments({
        externalAuthorId: AUTHOR,
      }),
      0,
    );
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.externalAuthorProvisionAttempts).countDocuments({
        externalAuthorId: OTHER_AUTHOR,
      }),
      1,
    );
    assert.equal(
      await getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).countDocuments({
        externalAuthorId: AUTHOR,
      }),
      0,
    );
    assert.equal(await getIntegrityMediaAuthorMessageStore().findByMessageId("99999999-9999-4999-8999-999999999999"), null);
    const store = getExternalAuthorLinkStore();
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId, OPERATION);
    assert.equal((await store.listDisconnectEvents()).length, 0);
    assert.equal((await store.listResults()).length, 1);

    const repeated = await deleteAuthor(OPERATION);
    assert.equal(repeated.ok, true);
    if (repeated.ok) {
      assert.equal(repeated.idempotent, true);
      assert.deepEqual(repeated.withheld, result.withheld);
      assert.deepEqual(repeated.removed, result.removed);
    }
    assert.ok(await findBlogPostById("post-ordinary"));
  });

  it("rolls back an interrupted cleanup and resumes it", async () => {
    await seedIdentity();
    await insertBlogPost(post("post-rollback", MEMBER));
    await insertBlogComment(comment("comment-rollback", "post-rollback"));
    await insertArticleDelivery(delivery("pub-rollback", AUTHOR, "post-rollback"));
    await getExternalAuthorLinkStore().insertLink(link());
    setAuthorDeletionCleanupFailureForTests("after_writes");
    const interrupted = await deleteAuthor(OPERATION);
    assert.equal(interrupted.ok, false);
    if (!interrupted.ok) {
      assert.equal(interrupted.code, "cleanup_incomplete");
    }
    assert.ok(await findBlogPostById("post-rollback"));
    assert.ok(await findBlogCommentById("comment-rollback"));
    assert.ok(await findArticleDelivery("pub-rollback"));
    assert.equal(
      (await getExternalAuthorLinkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.authorDeletionPending,
      true,
    );
    assert.equal(
      (await getExternalAuthorLinkStore().findAuthorDeletionReceipt(OPERATION))?.status,
      "pending",
    );
    assert.equal(await getMongoCollection(MONGO_COLLECTIONS.authUsers).countDocuments({ email: KEPT_EMAIL }), 1);

    setAuthorDeletionCleanupFailureForTests("off");
    const resumed = await deleteAuthor(OPERATION);
    assert.equal(resumed.ok, true);
    if (resumed.ok) {
      assert.equal(resumed.status, "completed");
      assert.equal(resumed.idempotent, false);
    }
    assert.equal(await findBlogPostById("post-rollback"), null);
    assert.equal(await findArticleDelivery("pub-rollback"), null);
    assert.equal(await getExternalAuthorLinkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.ok(await getExternalAuthorLinkStore().findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR));
    assert.equal(await getMongoCollection(MONGO_COLLECTIONS.authUsers).countDocuments({ email: KEPT_EMAIL }), 1);
    assert.equal(await getMongoCollection(MONGO_COLLECTIONS.members).countDocuments({ displayName: "Kept Member" }), 1);
  });

  it("treats overlapping requests as one completed cleanup", async () => {
    await getExternalAuthorLinkStore().insertLink(link());
    await insertBlogPost(post("post-race", MEMBER));
    await insertArticleDelivery(delivery("pub-race", AUTHOR, "post-race"));
    const now = Math.floor(Date.now() / 1000);
    const [first, second] = await Promise.all([
      deleteAuthor(OPERATION, { timestamp: String(now) }),
      deleteAuthor(OPERATION, { timestamp: String(now - 1) }),
    ]);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(second.ok, true, JSON.stringify(second));
    if (first.ok && second.ok) {
      assert.equal([first.idempotent, second.idempotent].includes(false), true);
      assert.equal([first.idempotent, second.idempotent].includes(true), true);
    }
    assert.equal(await findBlogPostById("post-race"), null);
    assert.equal(await getExternalAuthorLinkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
  });

  it("does not let a rejected operation block a new operation", async () => {
    await getExternalAuthorLinkStore().insertLink(link());
    const rejected = await deleteAuthor(OPERATION, { expectedMemberId: OTHER_MEMBER });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, "member_mismatch");
    }
    assert.equal(await getExternalAuthorLinkStore().findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    const corrected = await deleteAuthor(OPERATION_2);
    assert.equal(corrected.ok, true);
    if (corrected.ok) {
      assert.equal(corrected.status, "completed");
    }
    assert.equal(
      (await getExternalAuthorLinkStore().findAuthorDeletionReceipt(OPERATION))?.status,
      "rejected",
    );
    assert.equal(
      (await getExternalAuthorLinkStore().findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId,
      OPERATION_2,
    );
  });

  it("refuses a new link after the tombstone commits", async () => {
    await getExternalAuthorLinkStore().insertLink(link());
    const deleted = await deleteAuthor(OPERATION);
    assert.equal(deleted.ok, true);
    assert.equal(await getExternalAuthorLinkStore().insertLink(link()), "duplicate");
    assert.equal(await getExternalAuthorLinkStore().findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
  });
});

async function deleteAuthor(
  operationId: string,
  extra: { expectedMemberId?: string; timestamp?: string } = {},
) {
  const timestamp = extra.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const body = {
    operationId,
    authorId: AUTHOR,
    huTarget: "staging",
    expectedMemberId: extra.expectedMemberId ?? MEMBER,
    expectedLinkRevision: 1,
    expectedLinkInstanceId: INSTANCE,
  };
  return acceptIntegrityMediaAuthorDeletion({
    ...body,
    timestamp,
    signature: signIntegrityMediaAuthorDeletion(
      SECRET,
      buildIntegrityMediaAuthorDeletionPayload({ ...body, timestamp }),
    ),
    secret: SECRET,
  });
}

async function seedIdentity(): Promise<void> {
  await getMongoCollection(MONGO_COLLECTIONS.authUsers).insertOne({
    userId: "kept-user",
    email: KEPT_EMAIL,
    passwordHash: "not-a-credential",
    displayName: "Kept Member",
    role: "member",
    status: "active",
    memberId: MEMBER,
    emailVerificationStatus: "verified",
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  });
  await getMongoCollection(MONGO_COLLECTIONS.members).insertOne({
    memberId: MEMBER,
    displayName: "Kept Member",
  });
  await getMongoCollection(MONGO_COLLECTIONS.memberProfiles).insertOne({
    userId: "kept-user",
    displayName: "Kept Profile",
  });
  await upsertBlogCapabilityGrant({
    participantId: MEMBER,
    capabilities: ["author"],
    updatedAt: STORED_AT,
  });
}

async function seedOwnershipMatrix(): Promise<void> {
  const store = getExternalAuthorLinkStore();
  await store.insertLink(link());
  for (const entry of [
    post("post-proven", MEMBER),
    post("post-ordinary", MEMBER),
    post("post-case", MEMBER),
    post("post-mismatch", OTHER_MEMBER),
    post("post-other", OTHER_MEMBER),
    post("post-unowned", MEMBER),
  ]) {
    await insertBlogPost(entry);
  }
  await insertBlogComment(comment("comment-proven", "post-proven"));
  await insertBlogComment(comment("comment-ordinary", "post-ordinary"));
  await setBlogReaction({ postId: "post-proven", actorParticipantId: OTHER_MEMBER, reaction: "helpful" });
  await setBlogReaction({ postId: "post-ordinary", actorParticipantId: ADMIN_MEMBER, reaction: "helpful" });
  await claimBlogPublicationDelivery({ postId: "post-proven", subscriberId: "subscriber-proven", maxAttempts: 3 });
  await claimBlogPublicationDelivery({ postId: "post-ordinary", subscriberId: "subscriber-ordinary", maxAttempts: 3 });
  await upsertContentTranslation(translation("blog_post", "post-proven", "tr-proven"));
  await upsertContentTranslation(translation("discussion_comment", "post-proven", "tr-comment"));
  await insertArticleDelivery(delivery("pub-proven", AUTHOR, "post-proven"));
  await insertArticleDelivery(delivery("pub-case", AUTHOR.toUpperCase(), "post-case"));
  await insertArticleDelivery(delivery("pub-missing-post", AUTHOR, null));
  await insertArticleDelivery(delivery("pub-absent-post", AUTHOR, "post-does-not-exist"));
  await insertArticleDelivery(delivery("pub-mismatch", AUTHOR, "post-mismatch"));
  await insertArticleDelivery(delivery("pub-other", OTHER_AUTHOR, "post-other"));
  const unowned = delivery("pub-no-author", AUTHOR, "post-unowned");
  delete unowned.authorId;
  await insertArticleDelivery(unowned);
  await getIntegrityMediaAuthorMessageStore().insert({
    messageId: "99999999-9999-4999-8999-999999999999",
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    recipientMemberId: MEMBER,
    recipientExternalAuthorId: AUTHOR,
    direction: "hu_to_im",
    kind: "system",
    category: "notification",
    title: "Kept",
    body: "Evidence stays.",
    cta: null,
    status: "delivered",
    attemptCount: 1,
    lastAttemptAt: STORED_AT,
    nextAttemptAt: null,
    deliveredAt: STORED_AT,
    lastErrorCode: null,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  });
  await getMongoCollection(MONGO_COLLECTIONS.externalAuthorProvisionAttempts).insertMany([
    {
      attemptId: "attempt-author-1",
      externalAuthorId: AUTHOR,
      email: "hidden@example.com",
      displayName: "Hidden Name",
      target: "staging",
      expiresAt: 4_000_000_000,
      returnPath: "/return",
      emailVerification: "pending",
      memberId: MEMBER,
      userId: "kept-user",
      createdMember: false,
      createdAt: STORED_AT,
      updatedAt: STORED_AT,
    },
    {
      attemptId: "attempt-other-1",
      externalAuthorId: OTHER_AUTHOR,
      email: "other@example.com",
      displayName: "Other",
      target: "staging",
      expiresAt: 4_000_000_000,
      returnPath: "/return",
      emailVerification: "pending",
      memberId: OTHER_MEMBER,
      userId: "other-user",
      createdMember: false,
      createdAt: STORED_AT,
      updatedAt: STORED_AT,
    },
  ]);
  await getMongoCollection(MONGO_COLLECTIONS.externalAuthorSsoGrants).insertOne({
    grantId: "grant-author",
    requestId: "request-author",
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    userId: "kept-user",
    linkRevision: 1,
    target: "staging",
    expiresAt: "2099-01-01T00:00:00.000Z",
    consumedAt: null,
    createdAt: STORED_AT,
  });
  await store.insertDisconnectEvent({
    eventId: OPERATION_2,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    linkRevision: 1,
    outcome: "disabled",
    createdAt: STORED_AT,
  });
  await store.insertResult({
    resultCode: "r".repeat(32),
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: "attempt-state-ok1",
    memberId: MEMBER,
    expiresAt: "2099-01-01T00:00:00.000Z",
    consumedAt: null,
    createdAt: STORED_AT,
  });
}

async function clearDisposableData(): Promise<void> {
  const names = [
    MONGO_COLLECTIONS.authUsers,
    MONGO_COLLECTIONS.members,
    MONGO_COLLECTIONS.memberProfiles,
    MONGO_COLLECTIONS.blogPosts,
    MONGO_COLLECTIONS.blogComments,
    MONGO_COLLECTIONS.blogReactions,
    MONGO_COLLECTIONS.blogPublicationDeliveries,
    MONGO_COLLECTIONS.blogCapabilityGrants,
    MONGO_COLLECTIONS.contentTranslations,
    MONGO_COLLECTIONS.externalAuthorLinks,
    MONGO_COLLECTIONS.externalAuthorLinkResults,
    MONGO_COLLECTIONS.externalAuthorLinkAudit,
    MONGO_COLLECTIONS.externalAuthorDisconnectEvents,
    MONGO_COLLECTIONS.externalAuthorDeletionReceipts,
    MONGO_COLLECTIONS.externalAuthorDeletionTombstones,
    MONGO_COLLECTIONS.externalAuthorDeletionGuards,
    MONGO_COLLECTIONS.externalAuthorProvisionAttempts,
    MONGO_COLLECTIONS.externalAuthorSsoGrants,
    MONGO_COLLECTIONS.integrityMediaArticleDeliveries,
    MONGO_COLLECTIONS.integrityMediaAuthorMessages,
    MONGO_COLLECTIONS.integrityMediaAuthorMessageAudit,
  ];
  for (const name of names) {
    await getMongoCollection(name).deleteMany({});
  }
}

function link(): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    state: "linked",
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
    confirmedAt: STORED_AT,
    disconnectedAt: null,
    collaborationStatus: "active",
    authorActivationPending: false,
    linkRevision: 1,
    linkFinalization: "confirmed",
    linkInstanceId: INSTANCE,
  };
}

function post(postId: string, authorParticipantId: string): BlogPost {
  return {
    postId,
    authorParticipantId,
    authorDisplayNameSnapshot: "Participant",
    title: postId,
    slug: postId,
    excerpt: "Excerpt",
    content: "<p>Kept body</p>",
    categoryId: "our_life",
    tags: ["dispatch"],
    coverMedia: null,
    status: "published",
    originalLanguage: "en",
    safetyOutcome: "accepted",
    review: { reviewStatus: "none" },
    publishedVersion: 1,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
    publishedAt: STORED_AT,
  };
}

function comment(commentId: string, postId: string) {
  return {
    commentId,
    postId,
    authorParticipantId: OTHER_MEMBER,
    authorDisplayNameSnapshot: "Reader",
    content: "A comment that stays with its post.",
    status: "visible" as const,
    moderationState: "none" as const,
    safetyOutcome: null,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  };
}

function delivery(publicationId: string, authorId: string, postId: string | null) {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    publicationId,
    payloadDigest: "ab".repeat(32),
    authorId,
    postId,
    status: "published" as const,
    phase: "complete" as const,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  };
}

function translation(
  sourceKind: "blog_post" | "discussion_comment",
  sourceRecordId: string,
  translationId: string,
) {
  return {
    translationId,
    sourceKind,
    sourceRecordId,
    sourceVersion: "1",
    sourceLanguage: "en" as const,
    targetLanguage: "es" as const,
    translatedContent: "texto",
    translationProvider: "deterministic" as const,
    translationKind: "machine" as const,
    createdAt: STORED_AT,
    stale: false,
    freshness: "current" as const,
  };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local port."));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForReplicaPrimary(uri: string, port: number): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const client = new MongoClient(uri, {
      directConnection: true,
      serverSelectionTimeoutMS: 2_000,
    });
    try {
      await client.connect();
      try {
        await client.db("admin").command({
          replSetInitiate: {
            _id: "rs0",
            members: [{ _id: 0, host: `127.0.0.1:${port}` }],
          },
        });
      } catch (error) {
        const code = typeof error === "object" && error && "codeName" in error ? error.codeName : "";
        if (code !== "AlreadyInitialized") {
          throw error;
        }
      }
      for (let probe = 0; probe < 50; probe += 1) {
        const hello = await client.db("admin").command({ hello: 1 });
        if (hello.isWritablePrimary === true) {
          return;
        }
        await delay(200);
      }
      throw new Error("Disposable mongod did not become primary.");
    } catch (error) {
      lastError = error;
      await delay(200);
    } finally {
      await client.close().catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Disposable mongod did not start.");
}

/** mongod keeps writing to its dbpath until it exits, so removal must wait for the exit. */
async function stopMongod(): Promise<void> {
  const child = mongod;
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = new Promise<true>((resolve) => child.once("exit", () => resolve(true)));
  child.kill("SIGTERM");
  if (await settlesWithin(exited, 15_000)) {
    return;
  }

  child.kill("SIGKILL");
  if (!(await settlesWithin(exited, 5_000))) {
    throw new Error("Disposable mongod did not exit.");
  }
}

async function settlesWithin(exited: Promise<true>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([exited, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function closeAppClient(): Promise<void> {
  try {
    await getMongoClient().close();
  } catch {
    // The client was never opened.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
