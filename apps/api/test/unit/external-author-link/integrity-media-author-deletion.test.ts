process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import type { BlogCapabilityGrant, BlogPost } from "@hu/types";
import express from "express";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  findBlogCommentById,
  insertBlogComment,
} from "../../../src/modules/blog/persistence/blog-comment.repository.js";
import {
  claimBlogPublicationDelivery,
  findBlogPublicationDelivery,
} from "../../../src/modules/blog/persistence/blog-publication-delivery.repository.js";
import {
  getBlogReactionSummary,
  setBlogReaction,
} from "../../../src/modules/blog/persistence/blog-reaction.repository.js";
import {
  findBlogCapabilityGrant,
  findBlogPostById,
  replaceBlogPost,
  resetBlogMemoryPersistenceForTests,
  upsertBlogCapabilityGrant,
} from "../../../src/modules/blog/persistence/blog.repository.js";
import {
  buildIntegrityMediaAuthorDeletionPayload,
  resetIntegrityMediaAuthorDeletionReplayCacheForTests,
  signIntegrityMediaAuthorDeletion,
} from "../../../src/modules/external-author-link/external-author-link.author-deletion.hmac.js";
import integrityMediaAuthorDeletionRouter from "../../../src/modules/external-author-link/external-author-link.author-deletion.routes.js";
import { setAuthorDeletionCleanupFailureForTests } from "../../../src/modules/external-author-link/external-author-link.author-deletion.cleanup.js";
import { setAuthorDeletionTransactionFailureForTests } from "../../../src/modules/external-author-link/external-author-link.author-deletion.rules.js";
import { insertArticleDelivery } from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import {
  buildArticleIngestPayload,
  resetArticleIngestReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.hmac.js";
import {
  listArticleDeliveriesForTests,
  resetArticleDeliveriesForTests,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.repository.js";
import {
  ArticleIngestError,
  ingestIntegrityMediaArticle,
} from "../../../src/modules/external-author-link/external-author-link.article-ingest.service.js";
import {
  INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV,
  INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaAuthorDisconnectCanonical,
  resetIntegrityMediaAuthorDisconnectReplayCacheForTests,
  signIntegrityMediaAuthorDisconnect,
} from "../../../src/modules/external-author-link/external-author-link.disconnect-hmac.js";
import { acceptIntegrityMediaAuthorDisconnect } from "../../../src/modules/external-author-link/external-author-link.disconnect.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  buildIntegrityMediaLinkRedeemPayload,
  resetIntegrityMediaAcknowledgeReplayCacheForTests,
  resetIntegrityMediaRedeemReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  EXTERNAL_AUTHOR_DELETION_GUARD_INDEXES,
  EXTERNAL_AUTHOR_DELETION_RECEIPT_INDEXES,
  EXTERNAL_AUTHOR_DELETION_TOMBSTONE_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import {
  createMemoryProvisionState,
  getProvisionMemoryForTests,
  setProvisionMemoryForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import {
  buildProvisionAttemptPayload,
  resetProvisionAttemptReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import {
  ProvisionRequestError,
  registerProvisionAttempt,
} from "../../../src/modules/external-author-link/external-author-link.provision.service.js";
import { reconcilePendingIntegrityMediaAuthorActivations } from "../../../src/modules/external-author-link/external-author-link.reconciliation.js";
import {
  acknowledgeIntegrityMediaLink,
  redeemIntegrityMediaLink,
  recoverProvenIntegrityMediaAuthorLink,
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemorySsoState,
  getSsoMemoryForTests,
  setSsoMemoryForTests,
} from "../../../src/modules/external-author-link/external-author-link.sso.database.js";
import { buildSsoGrantPayload } from "../../../src/modules/external-author-link/external-author-link.sso.hmac.js";
import { registerSsoGrant, SsoRequestError } from "../../../src/modules/external-author-link/external-author-link.sso.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  setMemoryAuthorLinkMutatorForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { sendIntegrityMediaAuthorMessage } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.service.js";
import {
  findContentTranslation,
  upsertContentTranslation,
} from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createMemoryIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
  type IntegrityMediaAuthorMessageStore,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import {
  acceptIntegrityMediaAuthorReply,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.service.js";
import {
  buildIntegrityMediaAuthorReplyCanonical,
  hashIntegrityMediaAuthorReplyContent,
  signIntegrityMediaAuthorReply,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.hmac.js";

const SECRET = "hu-author-deletion-test-secret";
const MEMBER = "11111111-1111-4111-8111-111111111111";
const OTHER_MEMBER = "22222222-2222-4222-8222-222222222222";
const ADMIN_MEMBER = "33333333-3333-4333-8333-333333333333";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INSTANCE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OPERATION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OPERATION_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OPERATION_3 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const STORED_AT = "2026-01-01T00:00:00.000Z";

interface DeletionBody {
  operationId: string;
  authorId: string;
  huTarget: string;
  expectedMemberId: string;
  expectedLinkRevision: number;
  expectedLinkInstanceId: string;
}

interface ApiBody {
  success: boolean;
  data: {
    operationId?: string;
    authorId?: string;
    status?: string;
    cleanup?: string;
    idempotent?: boolean;
    withheld?: Array<{ publicationId: string; postId: string | null; reason: string }>;
    removed?: { posts: number; articleDeliveries: number; links: number; messages: number };
  } | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let messages: IntegrityMediaAuthorMessageStore;
let ensureCalls = 0;
const users = new Map<string, AuthUserRecord>();
const previousEnv = {
  mode: process.env.PLATFORM_MODE,
  flag: process.env[INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV],
  secret: process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV],
  article: process.env[INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV],
  webOrigin: process.env.WEB_ORIGIN,
};

describe("Integrity Media author deletion foundation", () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/integrations/integrity-media", integrityMediaAuthorDeletionRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind the author deletion test server.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorMessageStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setAuthUserLookupOverrideForTests(null);
    setProvisionMemoryForTests(null);
    setSsoMemoryForTests(null);
    setAuthorDeletionTransactionFailureForTests(false);
    setAuthorDeletionCleanupFailureForTests("off");
    setMemoryAuthorLinkMutatorForTests(null);
    restoreEnv(previousEnv.mode, "PLATFORM_MODE");
    restoreEnv(previousEnv.flag, INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV);
    restoreEnv(previousEnv.secret, INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV);
    restoreEnv(previousEnv.article, INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV);
    restoreEnv(previousEnv.webOrigin, "WEB_ORIGIN");
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    store = createMemoryExternalAuthorLinkStore();
    messages = createMemoryIntegrityMediaAuthorMessageStore();
    setExternalAuthorLinkStoreForTests(store);
    setIntegrityMediaAuthorMessageStoreForTests(messages);
    setProvisionMemoryForTests(createMemoryProvisionState());
    setSsoMemoryForTests(createMemorySsoState());
    setAuthorDeletionTransactionFailureForTests(false);
    setAuthorDeletionCleanupFailureForTests("off");
    setMemoryAuthorLinkMutatorForTests(null);
    resetIntegrityMediaAuthorDeletionReplayCacheForTests();
    resetIntegrityMediaRedeemReplayCacheForTests();
    resetIntegrityMediaAcknowledgeReplayCacheForTests();
    resetIntegrityMediaAuthorDisconnectReplayCacheForTests();
    resetArticleIngestReplayCacheForTests();
    resetArticleDeliveriesForTests();
    resetProvisionAttemptReplayCacheForTests();
    resetBlogMemoryPersistenceForTests();
    ensureCalls = 0;
    users.clear();
    rememberUser("admin-user", ADMIN_MEMBER, "admin");
    rememberUser(`user-${MEMBER}`, MEMBER, "member");
    setAuthUserLookupOverrideForTests(async (userId) => users.get(userId) ?? null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => {
      ensureCalls += 1;
      throw new Error("author capability must stay untouched");
    });
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV] = "true";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV] = SECRET;
    process.env.WEB_ORIGIN = "https://staging.huws.org";
  });

  it("isolates the deletion HMAC purpose and the tombstone identity", () => {
    assert.equal(INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE, "integrity-media-author-deletion");
    assert.notEqual(INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE, INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE);
    assert.notEqual(INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE);
    const payload = buildIntegrityMediaAuthorDeletionPayload({
      timestamp: stamp(),
      operationId: OPERATION,
      authorId: AUTHOR,
      huTarget: "staging",
      expectedMemberId: MEMBER,
      expectedLinkRevision: 1,
      expectedLinkInstanceId: INSTANCE,
    });
    assert.equal(payload.split("\n")[0], INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE);
    assert.equal(payload.includes(OPERATION), true);
    assert.equal(payload.includes(AUTHOR), true);
    assert.equal(payload.includes(MEMBER), true);
    assert.equal(payload.includes(INSTANCE), true);
    assert.notEqual(
      signIntegrityMediaAuthorDeletion(SECRET, payload),
      signIntegrityMediaLinkRedeem(SECRET, payload.replace(INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE, INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE)),
    );
    assert.equal(
      EXTERNAL_AUTHOR_DELETION_TOMBSTONE_INDEXES.some(
        (index) => index.unique === true && index.key.source === 1 && index.key.externalAuthorId === 1,
      ),
      true,
    );
    assert.equal(
      EXTERNAL_AUTHOR_DELETION_RECEIPT_INDEXES.some(
        (index) => index.unique === true && index.key.operationId === 1,
      ),
      true,
    );
    assert.equal(
      EXTERNAL_AUTHOR_DELETION_GUARD_INDEXES.some(
        (index) => index.unique === true && index.key.source === 1 && index.key.externalAuthorId === 1,
      ),
      true,
    );
  });

  it("rejects a signature made for another purpose, a bad signature, a stale timestamp, and a bad request", async () => {
    await store.insertLink(confirmedLink());
    const body = deletionBody();
    const at = stamp();
    const foreign = signIntegrityMediaLinkRedeem(
      SECRET,
      buildIntegrityMediaAuthorDeletionPayload({ ...body, timestamp: at }).replace(
        INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE,
        INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
      ),
    );
    const wrongPurpose = await postDeletion(body, at, foreign);
    assert.equal(wrongPurpose.status, 401);
    assert.equal(wrongPurpose.body.meta.code, "invalid_signature");

    const invalid = await postDeletion(body, at, "ab".repeat(32));
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta.code, "invalid_signature");

    const stale = await postDeletion(body, stamp(-1_000));
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_timestamp");

    const malformed = await postDeletion({ ...body, operationId: "not-a-uuid" });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.meta.code, "invalid_request");

    const extra = await postRaw({ ...body, note: "no" }, stamp());
    assert.equal(extra.status, 400);
    assert.equal(extra.body.meta.code, "invalid_request");

    const query = await postRaw(body, stamp(), "?extra=1");
    assert.equal(query.status, 400);

    const wrongTarget = await postDeletion({ ...body, huTarget: "production" });
    assert.equal(wrongTarget.status, 409);
    assert.equal(wrongTarget.body.meta.code, "environment_rejected");
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.authorDeletionPending, undefined);
  });

  it("rejects a binding mismatch and a legacy link presented with an instance id", async () => {
    await store.insertLink(confirmedLink());
    const member = await postDeletion(deletionBody({ expectedMemberId: OTHER_MEMBER, operationId: OPERATION }));
    assert.equal(member.status, 409);
    assert.equal(member.body.meta.code, "member_mismatch");

    const revision = await postDeletion(deletionBody({ expectedLinkRevision: 4, operationId: OPERATION_2 }));
    assert.equal(revision.status, 409);
    assert.equal(revision.body.meta.code, "revision_mismatch");

    await store.insertLink({ ...legacyLink(OTHER_AUTHOR), memberId: OTHER_MEMBER });
    const instance = await postDeletion(
      deletionBody({
        operationId: OPERATION_3,
        authorId: OTHER_AUTHOR,
        expectedMemberId: OTHER_MEMBER,
        expectedLinkInstanceId: INSTANCE,
      }),
    );
    assert.equal(instance.status, 409);
    assert.equal(instance.body.meta.code, "instance_mismatch");
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, OTHER_AUTHOR), null);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "rejected");
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, OTHER_AUTHOR))?.linkInstanceId, undefined);
  });

  it("completes a legacy link deletion and keeps the tombstone", async () => {
    await store.insertLink(legacyLink());
    const first = await postDeletion(
      deletionBody({ expectedLinkInstanceId: "absent", expectedLinkRevision: 1 }),
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.success, true);
    assert.equal(first.body.data?.status, "completed");
    assert.equal(first.body.data?.cleanup, "completed");
    assert.equal(first.body.data?.idempotent, false);
    assert.equal(first.body.data?.removed?.links, 1);
    assert.equal(first.body.data?.removed?.posts, 0);
    assert.deepEqual(first.body.data?.withheld, []);
    assert.equal(first.body.message.includes("complete"), true);

    const second = await postDeletion(
      deletionBody({ expectedLinkInstanceId: "absent", expectedLinkRevision: 1 }),
    );
    assert.equal(second.status, 200);
    assert.equal(second.body.data?.idempotent, true);
    assert.equal(second.body.data?.status, "completed");
    assert.deepEqual(second.body.data?.removed, first.body.data?.removed);

    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    const tombstone = await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.deepEqual(Object.keys(tombstone ?? {}).sort(), [
      "createdAt",
      "externalAuthorId",
      "operationId",
      "source",
    ]);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "completed");
  });

  it("treats the same operation as idempotent and a different body as a conflict", async () => {
    await store.insertLink(confirmedLink());
    const first = await postDeletion(deletionBody());
    assert.equal(first.status, 200);
    const conflict = await postDeletion(deletionBody({ expectedLinkRevision: 2 }));
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "operation_conflict");
    const again = await postDeletion(deletionBody());
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.status, "completed");
    assert.equal(again.body.data?.idempotent, true);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId, OPERATION);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.expectedLinkRevision, 1);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "completed");
  });

  it("keeps one tombstone when deletion requests arrive together", async () => {
    await store.insertLink(confirmedLink());
    const [first, second] = await Promise.all([
      postDeletion(deletionBody({ operationId: OPERATION })),
      postDeletion(deletionBody({ operationId: OPERATION_2 })),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.equal(statuses.includes(200), true);
    assert.equal(statuses.every((status) => status === 200 || status === 404 || status === 503), true);
    const tombstone = await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(tombstone?.operationId === OPERATION || tombstone?.operationId === OPERATION_2, true);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    const third = await postDeletion(deletionBody({ operationId: OPERATION_3 }));
    assert.equal(third.status, 404);
    assert.equal(third.body.meta.code, "link_not_found");
    assert.equal(
      (await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId,
      tombstone?.operationId,
    );
    assert.equal(
      (await store.findAuthorDeletionReceipt(OPERATION))?.status === "completed" ||
        (await store.findAuthorDeletionReceipt(OPERATION_2))?.status === "completed",
      true,
    );

    const same = await Promise.all([
      postDeletion(deletionBody({ operationId: OPERATION, authorId: OTHER_AUTHOR })),
      postDeletion(deletionBody({ operationId: OPERATION, authorId: OTHER_AUTHOR })),
    ]);
    assert.equal(same[0].status, 409);
    assert.equal(same[1].status, 409);
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, OTHER_AUTHOR), null);
  });

  it("blocks reconnect, acknowledgement, ingestion, disconnect, activation, provisioning, sign-in, replies, and new messages", async () => {
    await store.insertLink(confirmedLink({ state: "disabled", disconnectedAt: STORED_AT }));
    await postDeletion(deletionBody());
    await store.insertResult({
      resultCode: "r".repeat(32),
      source: INTEGRITY_MEDIA_SOURCE,
      attemptState: "attempt-state-ok1",
      memberId: MEMBER,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
      createdAt: STORED_AT,
    });
    const redeemAt = stamp();
    const redeemed = await redeemIntegrityMediaLink({
      resultCode: "r".repeat(32),
      externalAuthorId: AUTHOR,
      timestamp: redeemAt,
      signature: signIntegrityMediaLinkRedeem(
        SECRET,
        buildIntegrityMediaLinkRedeemPayload({
          timestamp: redeemAt,
          resultCode: "r".repeat(32),
          externalAuthorId: AUTHOR,
          purpose: INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
        }),
      ),
      secret: SECRET,
    });
    assert.equal(redeemed.ok, false);
    if (!redeemed.ok) {
      assert.equal(redeemed.code, "author_deletion_pending");
    }
    const afterRedeem = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(afterRedeem, null);
    assert.equal(await store.insertLink(confirmedLink()), "duplicate");

    const acknowledgeAt = stamp();
    const acknowledged = await acknowledgeIntegrityMediaLink({
      eventId: OPERATION_2,
      externalAuthorId: AUTHOR,
      memberId: MEMBER,
      linkRevision: 1,
      linkInstanceId: INSTANCE,
      timestamp: acknowledgeAt,
      signature: signIntegrityMediaLinkRedeem(
        SECRET,
        buildIntegrityMediaLinkAcknowledgePayload({
          timestamp: acknowledgeAt,
          eventId: OPERATION_2,
          externalAuthorId: AUTHOR,
          memberId: MEMBER,
          linkRevision: 1,
          linkInstanceId: INSTANCE,
        }),
      ),
      secret: SECRET,
    });
    assert.equal(acknowledged.ok, false);
    if (!acknowledged.ok) {
      assert.equal(acknowledged.code, "author_deletion_pending");
    }
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);

    const publicationId = "pub-delete-1";
    const articleAt = stamp();
    await assert.rejects(
      () =>
        ingestIntegrityMediaArticle({
          body: articleBody(publicationId),
          timestamp: articleAt,
          signature: articleSignature(publicationId, articleAt),
        }),
      (error: unknown) => error instanceof ArticleIngestError && error.code === "author_deletion_pending",
    );
    assert.equal(listArticleDeliveriesForTests().length, 0);

    const disconnectAt = stamp();
    const disconnected = await acceptIntegrityMediaAuthorDisconnect({
      eventId: OPERATION_3,
      authorId: AUTHOR,
      timestamp: disconnectAt,
      signature: signIntegrityMediaAuthorDisconnect(
        SECRET,
        buildIntegrityMediaAuthorDisconnectCanonical({
          timestamp: disconnectAt,
          eventId: OPERATION_3,
          authorId: AUTHOR,
          linkRevision: 1,
        }),
      ),
      secret: SECRET,
      protocol: { kind: "numbered", linkRevision: 1 },
    });
    assert.equal(disconnected.ok, false);
    if (!disconnected.ok) {
      assert.equal(disconnected.code, "author_deletion_pending");
    }
    assert.equal((await store.listDisconnectEvents()).length, 0);

    const recovered = await recoverProvenIntegrityMediaAuthorLink({ externalAuthorId: AUTHOR });
    assert.equal(recovered.ok, false);
    if (!recovered.ok) {
      assert.equal(recovered.code, "author_deletion_pending");
    }
    await store.insertLink(
      confirmedLink({
        externalAuthorId: OTHER_AUTHOR,
        memberId: OTHER_MEMBER,
        authorActivationPending: true,
        linkInstanceId: "abababab-abab-4aba-8aba-abababababab",
      }),
    );
    const activation = await postDeletion(
      deletionBody({
        operationId: "12121212-1212-4121-8121-121212121212",
        authorId: OTHER_AUTHOR,
        expectedMemberId: OTHER_MEMBER,
        expectedLinkInstanceId: "abababab-abab-4aba-8aba-abababababab",
      }),
    );
    assert.equal(activation.status, 200);
    const reconciliation = await reconcilePendingIntegrityMediaAuthorActivations();
    assert.equal(reconciliation.examined, 0);
    assert.equal(reconciliation.recovered, 0);
    assert.equal(
      await store.claimNextPendingAuthorActivation({
        source: INTEGRITY_MEDIA_SOURCE,
        nowIso: new Date().toISOString(),
        eligibleBeforeIso: new Date().toISOString(),
      }),
      null,
    );

    await assert.rejects(
      () => registerProvisionAttempt(provisionInput()),
      (error: unknown) => error instanceof ProvisionRequestError && error.code === "author_deletion_pending",
    );
    await assert.rejects(
      () => registerSsoGrant(ssoInput()),
      (error: unknown) => error instanceof SsoRequestError && error.code === "author_deletion_pending",
    );

    const reply = await acceptIntegrityMediaAuthorReply(await replyInput());
    assert.equal(reply.ok, false);
    if (!reply.ok) {
      assert.equal(reply.code, "author_deletion_pending");
    }
    const sent = await sendIntegrityMediaAuthorMessage({
      actorUserId: "admin-user",
      actorMemberId: ADMIN_MEMBER,
      recipientMemberId: MEMBER,
      title: "Hello",
      body: "A note to the author.",
      cta: null,
    });
    assert.equal(sent.ok, false);
    if (!sent.ok) {
      assert.equal(sent.code, "link_missing");
    }
    assert.equal(ensureCalls, 0);
    assert.equal((await messages.list()).length, 0);
  });

  it("preserves Humanity Union identities and ordinary publications", async () => {
    await store.insertLink(confirmedLink());
    const post = samplePost();
    await replaceBlogPost(post);
    const grant: BlogCapabilityGrant = {
      participantId: MEMBER,
      capabilities: ["author"],
      updatedAt: STORED_AT,
    };
    await upsertBlogCapabilityGrant(grant);
    const existing = sampleMessage();
    const otherMessage = { ...sampleMessage(), messageId: OPERATION_2, recipientExternalAuthorId: OTHER_AUTHOR };
    await messages.insert(existing);
    await messages.insert(otherMessage);
    await store.insertResult({
      resultCode: "r".repeat(32),
      source: INTEGRITY_MEDIA_SOURCE,
      attemptState: "attempt-state-ok1",
      memberId: MEMBER,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
      createdAt: STORED_AT,
    });
    const adminBefore = users.get("admin-user");

    const response = await postDeletion(deletionBody());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.status, "completed");
    assert.equal(response.body.data?.cleanup, "completed");
    assert.equal(response.body.data?.removed?.messages, 1);

    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.externalAuthorId, AUTHOR);
    assert.deepEqual(await findBlogCapabilityGrant(MEMBER), grant);
    assert.deepEqual(await findBlogPostById(post.postId), post);
    assert.equal(await messages.findByMessageId(existing.messageId), null);
    assert.equal((await messages.findByMessageId(otherMessage.messageId))?.recipientExternalAuthorId, OTHER_AUTHOR);
    assert.equal((await store.listResults()).length, 1);
    assert.equal(users.get("admin-user")?.role, "admin");
    assert.equal(users.get("admin-user")?.memberId, adminBefore?.memberId);
    assert.equal(users.get(`user-${MEMBER}`)?.role, "member");
    const receipt = await store.findAuthorDeletionReceipt(OPERATION);
    const stored = JSON.stringify({
      response: response.body,
      receipt,
      tombstone: await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR),
    });
    assert.equal(stored.includes("example.com"), false);
    assert.equal(stored.includes(post.content), false);
    assert.equal(stored.includes(existing.body), false);
    assert.equal(JSON.stringify(response.body.data?.withheld ?? []).includes(MEMBER), false);
  });

  it("does nothing while the feature flag is off", async () => {
    await store.insertLink(confirmedLink());
    delete process.env[INTEGRITY_MEDIA_AUTHOR_DELETION_ENABLED_ENV];
    const response = await postDeletion(deletionBody());
    assert.equal(response.status, 503);
    assert.equal(response.body.meta.code, "author_deletion_disabled");
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal(await store.findAuthorDeletionReceipt(OPERATION), null);
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.authorDeletionPending, undefined);
  });

  it("fails closed when the deletion transaction is unavailable and can be retried", async () => {
    await store.insertLink(confirmedLink());
    const body = deletionBody();
    const at = stamp();
    setAuthorDeletionTransactionFailureForTests(true);
    const failed = await postDeletion(body, at);
    assert.equal(failed.status, 503);
    assert.equal(failed.body.meta.code, "deletion_unavailable");
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal(await store.findAuthorDeletionReceipt(OPERATION), null);

    setAuthorDeletionTransactionFailureForTests(false);
    const retried = await postDeletion(body, at);
    assert.equal(retried.status, 200);
    assert.equal(retried.body.data?.status, "completed");
    assert.equal(retried.body.data?.idempotent, false);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId, OPERATION);
  });

  it("deletes only posts with exact author, delivery, and member ownership", async () => {
    await store.insertLink(confirmedLink());
    const proven = samplePost("post-proven", MEMBER);
    const ordinary = samplePost("post-ordinary", MEMBER);
    const casePost = samplePost("post-case", MEMBER);
    const mismatch = samplePost("post-mismatch", OTHER_MEMBER);
    const otherPost = samplePost("post-other", OTHER_MEMBER);
    const unowned = samplePost("post-unowned", MEMBER);
    for (const post of [proven, ordinary, casePost, mismatch, otherPost, unowned]) {
      await replaceBlogPost(post);
    }
    await insertBlogComment(sampleComment("comment-proven", proven.postId));
    await insertBlogComment(sampleComment("comment-ordinary", ordinary.postId));
    await setBlogReaction({ postId: proven.postId, actorParticipantId: OTHER_MEMBER, reaction: "helpful" });
    await setBlogReaction({ postId: ordinary.postId, actorParticipantId: ADMIN_MEMBER, reaction: "helpful" });
    await claimBlogPublicationDelivery({ postId: proven.postId, subscriberId: "subscriber-proven", maxAttempts: 3 });
    await claimBlogPublicationDelivery({ postId: ordinary.postId, subscriberId: "subscriber-ordinary", maxAttempts: 3 });
    await upsertContentTranslation(sampleTranslation("blog_post", proven.postId, "tr-proven"));
    await upsertContentTranslation(sampleTranslation("discussion_comment", proven.postId, "tr-comment"));
    await insertArticleDelivery(sampleDelivery("pub-proven", AUTHOR, proven.postId));
    await insertArticleDelivery(sampleDelivery("pub-case", AUTHOR.toUpperCase(), casePost.postId));
    await insertArticleDelivery(sampleDelivery("pub-missing-post", AUTHOR, null));
    await insertArticleDelivery(sampleDelivery("pub-absent-post", AUTHOR, "post-does-not-exist"));
    await insertArticleDelivery(sampleDelivery("pub-mismatch", AUTHOR, mismatch.postId));
    await insertArticleDelivery(sampleDelivery("pub-other", OTHER_AUTHOR, otherPost.postId));
    await insertArticleDelivery({ ...sampleDelivery("pub-no-author", AUTHOR, unowned.postId), authorId: undefined });
    await messages.insert(sampleMessage());
    await messages.appendAudit({
      eventId: "audit-message-1",
      action: "integrity_media_message_delivered",
      messageId: sampleMessage().messageId,
      actorMemberId: ADMIN_MEMBER,
      recipientMemberId: MEMBER,
      recipientExternalAuthorId: AUTHOR,
      errorCode: null,
      createdAt: STORED_AT,
    });
    const provision = getProvisionMemoryForTests();
    assert.ok(provision);
    await provision.view().insertAttempt({
      attemptId: "attempt-author-1",
      externalAuthorId: AUTHOR,
      email: "hidden@example.com",
      displayName: "Hidden Name",
      target: "staging",
      expiresAt: 4_000_000_000,
      returnPath: "/return",
      emailVerification: "pending",
      memberId: MEMBER,
      userId: "user-1",
      createdMember: false,
      createdAt: STORED_AT,
      updatedAt: STORED_AT,
    });
    await provision.view().insertAttempt({
      attemptId: "attempt-other-1",
      externalAuthorId: OTHER_AUTHOR,
      email: "other@example.com",
      displayName: "Other",
      target: "staging",
      expiresAt: 4_000_000_000,
      returnPath: "/return",
      emailVerification: "pending",
      memberId: OTHER_MEMBER,
      userId: "user-2",
      createdMember: false,
      createdAt: STORED_AT,
      updatedAt: STORED_AT,
    });
    const sso = getSsoMemoryForTests();
    assert.ok(sso);
    await sso.view().insertGrant({
      grantId: "grant-author",
      requestId: "request-author",
      externalAuthorId: AUTHOR,
      memberId: MEMBER,
      userId: "user-1",
      linkRevision: 1,
      target: "staging",
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: null,
      createdAt: STORED_AT,
    });
    await sso.view().insertGrant({
      grantId: "grant-other",
      requestId: "request-other",
      externalAuthorId: OTHER_AUTHOR,
      memberId: OTHER_MEMBER,
      userId: "user-2",
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
    await store.appendAudit({
      eventId: "link-audit-1",
      action: "link_acknowledged",
      source: INTEGRITY_MEDIA_SOURCE,
      memberId: MEMBER,
      externalAuthorId: AUTHOR,
      attemptStateHash: null,
      reason: null,
      createdAt: STORED_AT,
    });

    const response = await postDeletion(deletionBody());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.status, "completed");
    assert.equal(response.body.data?.removed?.posts, 1);
    assert.equal(response.body.data?.removed?.articleDeliveries, 1);
    assert.equal(response.body.data?.removed?.links, 1);
    assert.deepEqual(
      response.body.data?.withheld?.map((entry) => entry.reason).sort(),
      ["author_id_case_variant", "missing_post_id", "post_missing", "post_owner_mismatch"],
    );
    const withheldText = JSON.stringify(response.body.data?.withheld);
    assert.equal(withheldText.includes("example.com"), false);
    assert.equal(withheldText.includes("Hidden"), false);
    assert.equal(withheldText.includes(MEMBER), false);

    assert.equal(await findBlogPostById(proven.postId), null);
    assert.deepEqual(await findBlogPostById(ordinary.postId), ordinary);
    assert.deepEqual(await findBlogPostById(casePost.postId), casePost);
    assert.deepEqual(await findBlogPostById(mismatch.postId), mismatch);
    assert.deepEqual(await findBlogPostById(otherPost.postId), otherPost);
    assert.deepEqual(await findBlogPostById(unowned.postId), unowned);
    assert.equal(await findBlogCommentById("comment-proven"), null);
    assert.equal((await findBlogCommentById("comment-ordinary"))?.postId, ordinary.postId);
    assert.equal((await getBlogReactionSummary({ postId: proven.postId })).helpful, 0);
    assert.equal((await getBlogReactionSummary({ postId: ordinary.postId })).helpful, 1);
    assert.equal(await findBlogPublicationDelivery(proven.postId, "subscriber-proven"), null);
    assert.ok(await findBlogPublicationDelivery(ordinary.postId, "subscriber-ordinary"));
    assert.equal(
      await findContentTranslation({
        sourceKind: "blog_post",
        sourceRecordId: proven.postId,
        sourceVersion: "1",
        targetLanguage: "es",
      }),
      null,
    );
    assert.ok(
      await findContentTranslation({
        sourceKind: "discussion_comment",
        sourceRecordId: proven.postId,
        sourceVersion: "1",
        targetLanguage: "es",
      }),
    );
    const deliveries = listArticleDeliveriesForTests();
    assert.equal(deliveries.some((row) => row.publicationId === "pub-proven"), false);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-case"), true);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-missing-post"), true);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-absent-post"), true);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-mismatch"), true);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-other"), true);
    assert.equal(deliveries.some((row) => row.publicationId === "pub-no-author"), true);
    assert.equal(await messages.findByMessageId(sampleMessage().messageId), null);
    assert.equal((await messages.listAudits()).length, 0);
    assert.equal(provision.attempts().some((attempt) => attempt.externalAuthorId === AUTHOR), false);
    assert.equal(provision.attempts().some((attempt) => attempt.externalAuthorId === OTHER_AUTHOR), true);
    assert.equal(sso.grants().some((grant) => grant.externalAuthorId === AUTHOR), false);
    assert.equal(sso.grants().some((grant) => grant.externalAuthorId === OTHER_AUTHOR), true);
    assert.equal((await store.listDisconnectEvents()).length, 0);
    assert.equal((await store.listAudits()).length, 0);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);

    const repeated = await postDeletion(deletionBody());
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data?.idempotent, true);
    assert.deepEqual(repeated.body.data?.withheld, response.body.data?.withheld);
    assert.deepEqual(repeated.body.data?.removed, response.body.data?.removed);
    assert.deepEqual(await findBlogPostById(ordinary.postId), ordinary);
  });

  it("does not let a rejected operation block a corrected operation id", async () => {
    await store.insertLink(confirmedLink());
    const rejected = await postDeletion(deletionBody({ expectedMemberId: OTHER_MEMBER }));
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.meta.code, "member_mismatch");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "rejected");
    assert.equal(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);

    const corrected = await postDeletion(deletionBody({ operationId: OPERATION_2 }));
    assert.equal(corrected.status, 200);
    assert.equal(corrected.body.data?.status, "completed");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "rejected");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION_2))?.status, "completed");
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId, OPERATION_2);
  });

  it("refuses cleanup when the stored link no longer matches the receipt", async () => {
    await store.insertLink(confirmedLink());
    const proven = samplePost("post-binding", MEMBER);
    await replaceBlogPost(proven);
    await insertArticleDelivery(sampleDelivery("pub-binding", AUTHOR, proven.postId));
    setMemoryAuthorLinkMutatorForTests((link) => {
      link.memberId = OTHER_MEMBER;
    });
    const blocked = await postDeletion(deletionBody());
    assert.equal(blocked.status, 503);
    assert.equal(blocked.body.meta.code, "cleanup_incomplete");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "pending");
    assert.deepEqual(await findBlogPostById(proven.postId), proven);
    assert.equal(listArticleDeliveriesForTests().length, 1);
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.authorDeletionPending, true);

    setMemoryAuthorLinkMutatorForTests((link) => {
      link.memberId = MEMBER;
    });
    const resumed = await postDeletion(deletionBody());
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.data?.status, "completed");
    assert.equal(await findBlogPostById(proven.postId), null);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
  });

  it("keeps an interrupted cleanup pending and resumes it", async () => {
    await store.insertLink(confirmedLink());
    const proven = samplePost("post-resume", MEMBER);
    await replaceBlogPost(proven);
    await insertArticleDelivery(sampleDelivery("pub-resume", AUTHOR, proven.postId));
    const body = deletionBody();
    const at = stamp();
    setAuthorDeletionCleanupFailureForTests("before_writes");
    const interrupted = await postDeletion(body, at);
    assert.equal(interrupted.status, 503);
    assert.equal(interrupted.body.meta.code, "cleanup_incomplete");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "pending");
    assert.ok(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR));
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.memberId, MEMBER);
    assert.deepEqual(await findBlogPostById(proven.postId), proven);
    assert.equal(listArticleDeliveriesForTests().length, 1);

    setAuthorDeletionCleanupFailureForTests("off");
    const resumed = await postDeletion(body, at);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.data?.status, "completed");
    assert.equal(resumed.body.data?.idempotent, false);
    assert.equal(await findBlogPostById(proven.postId), null);
    assert.equal(listArticleDeliveriesForTests().length, 0);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.ok(await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR));
  });

  it("accepts the same operation once when requests overlap", async () => {
    await store.insertLink(confirmedLink());
    const proven = samplePost("post-concurrent", MEMBER);
    await replaceBlogPost(proven);
    await insertArticleDelivery(sampleDelivery("pub-concurrent", AUTHOR, proven.postId));
    const now = Math.floor(Date.now() / 1000);
    const [first, second] = await Promise.all([
      postDeletion(deletionBody(), String(now)),
      postDeletion(deletionBody(), String(now - 1)),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const flags = [first.body.data?.idempotent, second.body.data?.idempotent];
    assert.equal(flags.includes(false), true);
    assert.equal(flags.includes(true), true);
    assert.equal(await findBlogPostById(proven.postId), null);
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "completed");
  });

  it("refuses to recreate the author link after cleanup", async () => {
    await store.insertLink(confirmedLink());
    const response = await postDeletion(deletionBody());
    assert.equal(response.status, 200);
    assert.equal(await store.insertLink(confirmedLink()), "duplicate");
    const provision = getProvisionMemoryForTests();
    assert.ok(provision);
    assert.equal(await provision.view().insertLink(confirmedLink()), "duplicate");
    assert.equal(await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR), null);
    assert.equal(provision.links().length, 0);
  });
});

function confirmedLink(extra: Partial<ExternalAuthorLinkRecord> = {}): ExternalAuthorLinkRecord {
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
    ...extra,
  };
}

function legacyLink(authorId = AUTHOR): ExternalAuthorLinkRecord {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: authorId,
    memberId: MEMBER,
    state: "linked",
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
    confirmedAt: STORED_AT,
    disconnectedAt: null,
    collaborationStatus: "active",
  };
}

function deletionBody(extra: Partial<DeletionBody> = {}): DeletionBody {
  return {
    operationId: OPERATION,
    authorId: AUTHOR,
    huTarget: "staging",
    expectedMemberId: MEMBER,
    expectedLinkRevision: 1,
    expectedLinkInstanceId: INSTANCE,
    ...extra,
  };
}

function stamp(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}

async function postDeletion(body: DeletionBody, timestamp = stamp(), signature?: string): Promise<{ status: number; body: ApiBody }> {
  const at = timestamp;
  const signed = signature ?? signIntegrityMediaAuthorDeletion(SECRET, buildIntegrityMediaAuthorDeletionPayload({ ...body, timestamp: at }));
  return postRaw(body, at, "", signed);
}

async function postRaw(
  body: DeletionBody | (DeletionBody & { note: string }),
  timestamp: string,
  query = "",
  signature = signIntegrityMediaAuthorDeletion(
    SECRET,
    buildIntegrityMediaAuthorDeletionPayload({
      timestamp,
      operationId: body.operationId,
      authorId: body.authorId,
      huTarget: body.huTarget,
      expectedMemberId: body.expectedMemberId,
      expectedLinkRevision: body.expectedLinkRevision,
      expectedLinkInstanceId: body.expectedLinkInstanceId,
    }),
  ),
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${baseUrl}/api/v1/integrations/integrity-media/author-deletion${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER]: timestamp,
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER]: signature,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

function articleBody(publicationId: string) {
  return {
    publicationId,
    authorId: AUTHOR,
    huMemberId: MEMBER,
    title: "Public article",
    excerpt: "A short public excerpt for the Humanity Union Blog.",
    content: "<p>A public article for the Humanity Union Blog.</p>",
    language: "en",
    publishedAt: "2024-06-01",
    canonicalUrl: `https://example.com/articles/${publicationId}`,
    target: "staging",
  };
}

function articleSignature(publicationId: string, timestamp: string): string {
  const body = articleBody(publicationId);
  return signIntegrityMediaLinkRedeem(
    SECRET,
    buildArticleIngestPayload({
      timestamp,
      publicationId,
      authorId: AUTHOR,
      huMemberId: MEMBER,
      target: "staging",
      language: "en",
      publishedAt: body.publishedAt,
      canonicalUrl: body.canonicalUrl,
      title: body.title,
      excerpt: body.excerpt,
      content: body.content,
    }),
  );
}

function provisionInput() {
  const timestamp = stamp();
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const normalized = {
    attemptId: "provision-attempt-01",
    externalAuthorId: AUTHOR,
    email: "author@example.com",
    displayName: "Author",
    target: "staging",
    expiresAt,
    returnPath: "/api/author/humanity-union-link/complete",
    emailVerification: "pending",
  };
  return {
    body: normalized,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(
      SECRET,
      buildProvisionAttemptPayload({
        timestamp,
        attemptId: normalized.attemptId,
        externalAuthorId: normalized.externalAuthorId,
        email: normalized.email,
        displayName: normalized.displayName,
        target: normalized.target,
        expiresAt: String(expiresAt),
        returnPath: normalized.returnPath,
        emailVerification: normalized.emailVerification,
      }),
    ),
  };
}

function ssoInput() {
  const timestamp = stamp();
  const body = {
    timestamp,
    requestId: "sso-request-id-0001",
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    linkRevision: 1,
    target: "staging",
  };
  return {
    body,
    timestamp,
    signature: signIntegrityMediaLinkRedeem(SECRET, buildSsoGrantPayload({ ...body, linkRevision: "1" })),
  };
}

async function replyInput() {
  const timestamp = stamp();
  const body = "A short reply.";
  const value = {
    timestamp,
    messageId: OPERATION_2,
    authorId: AUTHOR,
    memberId: MEMBER,
    linkRevision: 1,
    body,
  };
  return {
    ...value,
    secret: SECRET,
    signature: signIntegrityMediaAuthorReply(
      SECRET,
      buildIntegrityMediaAuthorReplyCanonical({
        timestamp,
        messageId: value.messageId,
        authorId: AUTHOR,
        memberId: MEMBER,
        linkRevision: 1,
        replyToMessageId: "",
        contentSha256: hashIntegrityMediaAuthorReplyContent(body),
      }),
    ),
  };
}

function samplePost(postId = "post-kept", authorParticipantId = MEMBER): BlogPost {
  return {
    postId,
    authorParticipantId,
    authorDisplayNameSnapshot: "Participant",
    title: "Kept dispatch",
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

function sampleMessage() {
  return {
    messageId: "99999999-9999-4999-8999-999999999999",
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    recipientMemberId: MEMBER,
    recipientExternalAuthorId: AUTHOR,
    direction: "hu_to_im" as const,
    kind: "system" as const,
    category: "notification" as const,
    title: "Kept",
    body: "Evidence stays.",
    cta: null,
    status: "delivered" as const,
    attemptCount: 1,
    lastAttemptAt: STORED_AT,
    nextAttemptAt: null,
    deliveredAt: STORED_AT,
    lastErrorCode: null,
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  };
}

function rememberUser(userId: string, memberId: string, role: "member" | "admin"): void {
  users.set(userId, {
    userId,
    email: `${userId}@example.com`,
    passwordHash: "not-a-credential",
    displayName: "Test User",
    role,
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: STORED_AT,
    updatedAt: STORED_AT,
  });
}

function sampleDelivery(publicationId: string, authorId: string, postId: string | null) {
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

function sampleComment(commentId: string, postId: string) {
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

function sampleTranslation(
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

function restoreEnv(value: string | undefined, name: string): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
