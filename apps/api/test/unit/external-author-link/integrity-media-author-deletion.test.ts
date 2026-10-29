process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import type { BlogCapabilityGrant, BlogPost } from "@hu/types";
import express from "express";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  findBlogCapabilityGrant,
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
import { setAuthorDeletionTransactionFailureForTests } from "../../../src/modules/external-author-link/external-author-link.author-deletion.rules.js";
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
  EXTERNAL_AUTHOR_DELETION_RECEIPT_INDEXES,
  EXTERNAL_AUTHOR_DELETION_TOMBSTONE_INDEXES,
} from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import { createMemoryProvisionState, setProvisionMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
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
import { createMemorySsoState, setSsoMemoryForTests } from "../../../src/modules/external-author-link/external-author-link.sso.database.js";
import { buildSsoGrantPayload } from "../../../src/modules/external-author-link/external-author-link.sso.hmac.js";
import { registerSsoGrant, SsoRequestError } from "../../../src/modules/external-author-link/external-author-link.sso.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { sendIntegrityMediaAuthorMessage } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.service.js";
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

  it("accepts a legacy link without an instance id and stays pending", async () => {
    await store.insertLink(legacyLink());
    const first = await postDeletion(
      deletionBody({ expectedLinkInstanceId: "absent", expectedLinkRevision: 1 }),
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.success, true);
    assert.equal(first.body.data?.status, "pending");
    assert.equal(first.body.data?.cleanup, "pending");
    assert.equal(first.body.data?.idempotent, false);
    assert.equal(first.body.message.includes("pending"), true);
    assert.equal(JSON.stringify(first.body).includes("completed"), false);

    const second = await postDeletion(
      deletionBody({ expectedLinkInstanceId: "absent", expectedLinkRevision: 1 }),
    );
    assert.equal(second.status, 200);
    assert.equal(second.body.data?.idempotent, true);
    assert.equal(second.body.data?.status, "pending");

    const link = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(link?.authorDeletionPending, true);
    assert.equal(link?.linkInstanceId, undefined);
    assert.equal(link?.memberId, MEMBER);
    assert.equal(link?.state, "linked");
    const tombstone = await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.deepEqual(Object.keys(tombstone ?? {}).sort(), [
      "createdAt",
      "externalAuthorId",
      "operationId",
      "source",
    ]);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "pending");
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
    assert.equal(again.body.data?.idempotent, true);
    assert.equal((await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId, OPERATION);
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.expectedLinkRevision, 1);
  });

  it("keeps one tombstone when deletion requests arrive together", async () => {
    await store.insertLink(confirmedLink());
    const [first, second] = await Promise.all([
      postDeletion(deletionBody({ operationId: OPERATION })),
      postDeletion(deletionBody({ operationId: OPERATION_2 })),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.data?.status, "pending");
    assert.equal(second.body.data?.status, "pending");
    const tombstone = await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(tombstone?.operationId === OPERATION || tombstone?.operationId === OPERATION_2, true);
    const third = await postDeletion(deletionBody({ operationId: OPERATION_3 }));
    assert.equal(third.status, 200);
    assert.equal(third.body.data?.status, "pending");
    assert.equal(
      (await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.operationId,
      tombstone?.operationId,
    );
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION))?.status, "pending");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION_2))?.status, "pending");
    assert.equal((await store.findAuthorDeletionReceipt(OPERATION_3))?.status, "pending");

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
    assert.equal(afterRedeem?.state, "disabled");
    assert.equal(afterRedeem?.linkInstanceId, INSTANCE);
    assert.equal(await store.updateLink({ ...afterRedeem!, state: "linked", disconnectedAt: null }), "refused");

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
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.linkFinalization, "confirmed");

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
      assert.equal(sent.code, "author_deletion_pending");
    }
    assert.equal(ensureCalls, 0);
    assert.equal((await messages.list()).length, 0);
  });

  it("preserves the Humanity Union member, grant, Blog post, and existing message", async () => {
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
    await messages.insert(existing);
    const adminBefore = users.get("admin-user");

    const response = await postDeletion(deletionBody());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.cleanup, "pending");

    const link = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR);
    assert.equal(link?.memberId, MEMBER);
    assert.equal(link?.state, "linked");
    assert.deepEqual(await findBlogCapabilityGrant(MEMBER), grant);
    assert.deepEqual(await replaceBlogPost(post), post);
    const storedMessage = await messages.findByMessageId(existing.messageId);
    assert.equal(storedMessage?.body, existing.body);
    assert.equal((await messages.list()).length, 1);
    assert.equal(users.get("admin-user")?.role, "admin");
    assert.equal(users.get("admin-user")?.memberId, adminBefore?.memberId);
    assert.equal(users.get(`user-${MEMBER}`)?.role, "member");
    const receipt = await store.findAuthorDeletionReceipt(OPERATION);
    const stored = JSON.stringify({ receipt, tombstone: await store.findAuthorDeletionTombstone(INTEGRITY_MEDIA_SOURCE, AUTHOR) });
    assert.equal(stored.includes("example.com"), false);
    assert.equal(stored.includes(post.content), false);
    assert.equal(stored.includes(existing.body), false);
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
    assert.equal(retried.body.data?.status, "pending");
    assert.equal(retried.body.data?.idempotent, false);
    assert.equal((await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, AUTHOR))?.memberId, MEMBER);
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

function samplePost(): BlogPost {
  return {
    postId: "post-kept",
    authorParticipantId: MEMBER,
    authorDisplayNameSnapshot: "Participant",
    title: "Kept dispatch",
    slug: "post-kept",
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

function restoreEnv(value: string | undefined, name: string): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
