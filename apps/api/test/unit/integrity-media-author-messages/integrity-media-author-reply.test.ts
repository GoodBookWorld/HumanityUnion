import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";

import { setIntegrityMediaAuthorReplyAnnouncementDepsForTests } from "../../../src/modules/admin-notifications/integrity-media-author-reply-notification.js";
import { resetMemoryAdminNotificationPersistenceForTests } from "../../../src/modules/admin-notifications/persistence/admin-notification-memory.persistence.js";
import { resolveAdminNotificationPersistenceAdapter } from "../../../src/modules/admin-notifications/persistence/resolve-admin-notification-persistence.js";
import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_AUTHOR_REPLY_PURPOSE,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { setIntegrityMediaAuthorParticipantResolverForTests } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-directory.service.js";
import { reconcilePendingIntegrityMediaAuthorMessages } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.reconciliation.js";
import integrityMediaAuthorMessageRouter from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.routes.js";
import {
  createMemoryIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
  type IntegrityMediaAuthorMessageStore,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import type { IntegrityMediaAuthorMessageRecord } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.types.js";
import {
  buildIntegrityMediaAuthorReplyCanonical,
  buildIntegrityMediaAuthorReplyContentPayload,
  hashIntegrityMediaAuthorReplyContent,
  resetIntegrityMediaAuthorReplyReplayCacheForTests,
  signIntegrityMediaAuthorReply,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.hmac.js";
import integrityMediaAuthorReplyRouter from "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.routes.js";
import {
  setIntegrityMediaAuthorMessageTransportForTests,
  type IntegrityMediaAuthorMessageHttpRequest,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.transport.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_ONE = "admin-notify-1";
const ADMIN_TWO = "admin-notify-2";
const ADMIN_MEMBER = "33333333-3333-4333-8333-333333333333";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMBER = "44444444-4444-4444-8444-444444444444";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECRET = "hu-reply-test-secret";
const ORIGIN = "https://integrity.example";
const VECTOR_MESSAGE = "11111111-1111-4111-8111-111111111111";
const VECTOR_REPLY_TO = "12121212-1212-4212-8212-121212121212";
const VECTOR_BODY = "Hello from the author";

interface ApiBody {
  success: boolean;
  data: {
    messageId?: string;
    authorId?: string;
    memberId?: string;
    idempotent?: boolean;
    status?: string;
    messages?: Array<{
      messageId?: string;
      direction?: string;
      kind?: string;
      body?: string;
      replyToMessageId?: string | null;
      delivery?: { status?: string } | null;
    }>;
    pageInfo?: { hasMore?: boolean; nextCursor?: string | null };
  } | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let linkStore: ExternalAuthorLinkStore;
let messageStore: IntegrityMediaAuthorMessageStore;
const users = new Map<string, AuthUserRecord>();
let remoteRequests: IntegrityMediaAuthorMessageHttpRequest[] = [];

describe("Integrity Media inbound author replies", () => {
  before(async () => {
    setAuthUserLookupOverrideForTests(async (userId) => users.get(userId) ?? null);
    const app = express();
    app.use(express.json());
    app.use("/api/v1/integrations/integrity-media", integrityMediaAuthorReplyRouter);
    app.use("/api/v1/admin/integrity-media/authors", integrityMediaAuthorMessageRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind the author reply test server.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setAuthUserLookupOverrideForTests(null);
    setIntegrityMediaAuthorReplyAnnouncementDepsForTests(null);
    setIntegrityMediaAuthorParticipantResolverForTests(null);
    resetMemoryAdminNotificationPersistenceForTests();
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorMessageStoreForTests(null);
    setIntegrityMediaAuthorMessageTransportForTests(null);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    users.clear();
    remoteRequests = [];
    resetIntegrityMediaAuthorReplyReplayCacheForTests();
    setIntegrityMediaAuthorReplyAnnouncementDepsForTests(null);
    setIntegrityMediaAuthorParticipantResolverForTests(null);
    resetMemoryAdminNotificationPersistenceForTests();
    linkStore = createMemoryExternalAuthorLinkStore();
    messageStore = createMemoryIntegrityMediaAuthorMessageStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    setIntegrityMediaAuthorMessageStoreForTests(messageStore);
    setIntegrityMediaAuthorMessageTransportForTests(async (request) => {
      remoteRequests.push(request);
      const remote = JSON.parse(request.body) as { messageId: string; recipientAuthorId: string };
      return {
        kind: "response",
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            messageId: remote.messageId,
            recipientAuthorId: remote.recipientAuthorId,
            idempotent: false,
          },
        }),
      };
    });
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = ORIGIN;
    rememberAdmin();
  });

  it("publishes a deterministic HMAC vector with an empty reply target", () => {
    const payload = buildIntegrityMediaAuthorReplyContentPayload(VECTOR_BODY);
    assert.equal(payload, JSON.stringify({ body: VECTOR_BODY }));
    assert.equal(payload.indexOf('"body"'), 1);
    const hash = createHash("sha256").update(payload, "utf8").digest("hex");
    assert.equal(hashIntegrityMediaAuthorReplyContent(VECTOR_BODY), hash);
    assert.equal(payload.includes("kind"), false);
    const canonical = buildIntegrityMediaAuthorReplyCanonical({
      timestamp: "1700000000",
      messageId: VECTOR_MESSAGE,
      authorId: AUTHOR,
      memberId: MEMBER,
      linkRevision: 2,
      replyToMessageId: "",
      contentSha256: hash,
    });
    assert.equal(
      canonical,
      [
        INTEGRITY_MEDIA_AUTHOR_REPLY_PURPOSE,
        "1700000000",
        VECTOR_MESSAGE,
        AUTHOR,
        MEMBER,
        "2",
        "",
        hash,
      ].join("\n"),
    );
    assert.equal(canonical.split("\n").length, 8);
    assert.equal(canonical.split("\n")[0], "integrity-media-author-reply");
    assert.equal(canonical.split("\n")[6], "");
    const withParent = buildIntegrityMediaAuthorReplyCanonical({
      timestamp: "1700000000",
      messageId: VECTOR_MESSAGE,
      authorId: AUTHOR,
      memberId: MEMBER,
      linkRevision: 2,
      replyToMessageId: VECTOR_REPLY_TO,
      contentSha256: hash,
    });
    assert.equal(withParent.split("\n")[6], VECTOR_REPLY_TO);
    assert.equal(
      signIntegrityMediaAuthorReply(SECRET, canonical),
      createHmac("sha256", SECRET).update(canonical).digest("hex"),
    );
  });

  it("accepts a signed reply and stores one im_to_hu chat outside the scheduler", async () => {
    await seedLink();
    const usersBefore = users.size;
    const response = await postReply({ body: VECTOR_BODY });
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.idempotent, false);
    assert.equal(response.body.data?.authorId, AUTHOR);
    assert.equal(response.body.data?.memberId, MEMBER);
    const rows = await messageStore.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.direction, "im_to_hu");
    assert.equal(rows[0]?.kind, "chat");
    assert.equal(rows[0]?.status, "recorded");
    assert.equal(rows[0]?.body, VECTOR_BODY);
    assert.equal(rows[0]?.title, "");
    assert.equal(rows[0]?.linkRevision, 2);
    assert.equal(rows[0]?.replyToMessageId, undefined);
    assert.equal(rows[0]?.attemptCount, 0);
    assert.equal(users.size, usersBefore);
    assert.equal((await linkStore.listLinks()).length, 1);
    assert.equal(MONGO_COLLECTIONS.integrityMediaAuthorMessages, "integrity_media_author_messages");
    const source = readFileSync(
      path.join(
        here,
        "../../../src/modules/integrity-media-author-messages/integrity-media-author-reply.service.ts",
      ),
      "utf8",
    );
    assert.equal(source.includes("console."), false);
    await reconcilePendingIntegrityMediaAuthorMessages({
      now: new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS + 1000),
    });
    assert.equal(remoteRequests.length, 0);
    assert.equal((await messageStore.list())[0]?.attemptCount, 0);
    const audits = await messageStore.listAudits();
    assert.equal(audits.length, 1);
    assert.equal(audits[0]?.action, "integrity_media_author_reply_accepted");
    assert.equal(JSON.stringify(audits).includes(VECTOR_BODY), false);
    assert.equal(JSON.stringify(audits).includes(SECRET), false);
  });

  it("rejects a bad, missing, stale, future, or malformed signature timestamp", async () => {
    await seedLink();
    const bad = await postReply({ body: VECTOR_BODY, signature: "ab".repeat(32) });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.meta.code, "invalid_signature");
    const missing = await postReply({ body: VECTOR_BODY, signature: "" });
    assert.equal(missing.status, 401);
    assert.equal(missing.body.meta.code, "invalid_signature");
    const stale = await postReply({ body: "Earlier note", timestamp: stamp(-301) });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_timestamp");
    const future = await postReply({ body: "Later note", timestamp: stamp(301) });
    assert.equal(future.status, 401);
    assert.equal(future.body.meta.code, "stale_timestamp");
    const malformed = await postReply({ body: VECTOR_BODY, timestamp: "123" });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.meta.code, "invalid_request");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects ineligible links, bad bodies, unknown fields, and bad reply targets", async () => {
    const unknown = await postReply({ body: VECTOR_BODY });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.meta.code, "link_not_found");

    await seedLink();
    const wrongMember = await postReply({ body: VECTOR_BODY, memberId: OTHER_MEMBER });
    assert.equal(wrongMember.status, 409);
    assert.equal(wrongMember.body.meta.code, "member_mismatch");
    const wrongRevision = await postReply({ body: VECTOR_BODY, linkRevision: 9 });
    assert.equal(wrongRevision.status, 409);
    assert.equal(wrongRevision.body.meta.code, "revision_conflict");

    await updateLink({ state: "disabled", disconnectedAt: new Date().toISOString() });
    const disabled = await postReply({ body: "Disconnected" });
    assert.equal(disabled.status, 409);
    assert.equal(disabled.body.meta.code, "link_disabled");

    await updateLink({ state: "linked", disconnectedAt: null, collaborationStatus: "blocked" });
    const blocked = await postReply({ body: "Blocked" });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.meta.code, "collaboration_blocked");

    await updateLink({ collaborationStatus: "archived" });
    const archived = await postReply({ body: "Archived" });
    assert.equal(archived.status, 409);
    assert.equal(archived.body.meta.code, "collaboration_archived");

    await updateLink({ collaborationStatus: "active", authorActivationPending: true });
    const pending = await postReply({ body: "Pending" });
    assert.equal(pending.status, 409);
    assert.equal(pending.body.meta.code, "author_activation_pending");

    await updateLink({ authorActivationPending: false });
    const empty = await postReply({ body: "   " });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.meta.code, "invalid_request");
    const huge = await postReply({ body: "a".repeat(8001) });
    assert.equal(huge.status, 400);
    assert.equal(huge.body.meta.code, "payload_too_large");
    const extra = await postReply({
      body: VECTOR_BODY,
      extra: { direction: "hu_to_im", kind: "system" },
    });
    assert.equal(extra.status, 400);
    assert.equal(extra.body.meta.code, "invalid_request");

    await seedMessage({
      messageId: VECTOR_REPLY_TO,
      recipientMemberId: OTHER_MEMBER,
      recipientExternalAuthorId: OTHER_AUTHOR,
      direction: "hu_to_im",
      kind: "system",
    });
    const wrongPair = await postReply({ body: VECTOR_BODY, replyToMessageId: VECTOR_REPLY_TO });
    assert.equal(wrongPair.status, 400);
    assert.equal(wrongPair.body.meta.code, "invalid_request");

    const inboundId = "13131313-1313-4313-8313-131313131313";
    await seedMessage({
      messageId: inboundId,
      recipientMemberId: MEMBER,
      recipientExternalAuthorId: AUTHOR,
      direction: "im_to_hu",
      kind: "chat",
      status: "recorded",
    });
    const inboundRef = await postReply({ body: VECTOR_BODY, replyToMessageId: inboundId });
    assert.equal(inboundRef.status, 400);
    assert.equal((await messageStore.list()).some((row) => row.body === VECTOR_BODY), false);
  });

  it("accepts a reply without a parent and a reply to an outbound message on this pair", async () => {
    await seedLink();
    const outboundId = "14141414-1414-4414-8414-141414141414";
    await seedMessage({
      messageId: outboundId,
      recipientMemberId: MEMBER,
      recipientExternalAuthorId: AUTHOR,
      direction: "hu_to_im",
      kind: "chat",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    const plain = await postReply({ body: "No parent" });
    assert.equal(plain.status, 200);
    const threaded = await postReply({ body: "With parent", replyToMessageId: outboundId });
    assert.equal(threaded.status, 200);
    const stored = (await messageStore.list()).find((row) => row.body === "With parent");
    assert.equal(stored?.replyToMessageId, outboundId);
    assert.equal(stored?.direction, "im_to_hu");
    const history = await getHistory();
    const plainView = history.body.data?.messages?.find((row) => row.body === "No parent");
    const threadedView = history.body.data?.messages?.find((row) => row.body === "With parent");
    const outboundView = history.body.data?.messages?.find((row) => row.messageId === outboundId);
    assert.equal(plainView?.direction, "im_to_hu");
    assert.equal(plainView?.kind, "chat");
    assert.equal(plainView?.replyToMessageId ?? null, null);
    assert.equal(plainView?.delivery ?? null, null);
    assert.equal(threadedView?.replyToMessageId, outboundId);
    assert.equal(outboundView?.direction, "hu_to_im");
    assert.equal(history.body.data?.messages?.[0]?.messageId, outboundId);
  });

  it("keeps one row for an identical retry and rejects a conflicting body", async () => {
    await seedLink();
    const messageId = randomUUID();
    const first = await postReply({ messageId, body: VECTOR_BODY });
    assert.equal(first.body.data?.idempotent, false);
    const retry = await postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(1) });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data?.idempotent, true);
    assert.equal((await messageStore.list()).length, 1);
    assert.equal(
      (await messageStore.listAudits()).filter((row) => row.action === "integrity_media_author_reply_accepted")
        .length,
      1,
    );
    const conflict = await postReply({ messageId, body: "Different text", timestamp: stamp(2) });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "message_conflict");
    assert.equal((await messageStore.list())[0]?.body, VECTOR_BODY);
  });

  it("collapses concurrent duplicate deliveries to one row", async () => {
    await seedLink();
    const messageId = randomUUID();
    const [left, right] = await Promise.all([
      postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(0) }),
      postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(1) }),
    ]);
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    assert.equal([left.body.data?.idempotent, right.body.data?.idempotent].filter((value) => value === false).length, 1);
    assert.equal((await messageStore.list()).length, 1);
    assert.equal(
      (await messageStore.listAudits()).filter((row) => row.action === "integrity_media_author_reply_accepted")
        .length,
      1,
    );
  });

  it("acknowledges a stored reply after disconnect or reconnect and rejects a stale generation", async () => {
    await seedLink();
    const messageId = randomUUID();
    assert.equal((await postReply({ messageId, body: VECTOR_BODY })).status, 200);
    await updateLink({ state: "disabled", disconnectedAt: new Date().toISOString() });
    const afterDisconnect = await postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(1) });
    assert.equal(afterDisconnect.status, 200);
    assert.equal(afterDisconnect.body.data?.idempotent, true);
    assert.equal((await messageStore.list()).length, 1);

    await updateLink({
      state: "linked",
      disconnectedAt: null,
      linkRevision: 3,
      collaborationStatus: "active",
    });
    const afterReconnect = await postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(2) });
    assert.equal(afterReconnect.status, 200);
    assert.equal(afterReconnect.body.data?.idempotent, true);
    const stale = await postReply({ body: "Old generation", linkRevision: 2, timestamp: stamp(3) });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.meta.code, "revision_conflict");
    assert.equal((await messageStore.list()).length, 1);

    await updateLink({ collaborationStatus: "blocked" });
    const blocked = await postReply({ body: "After block", linkRevision: 3, timestamp: stamp(4) });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.meta.code, "collaboration_blocked");
    await updateLink({ collaborationStatus: "archived" });
    const archived = await postReply({ body: "After archive", linkRevision: 3, timestamp: stamp(5) });
    assert.equal(archived.status, 409);
    assert.equal(archived.body.meta.code, "collaboration_archived");
    assert.equal((await messageStore.list()).length, 1);
  });

  it("keeps outbound notification v1, chat v2, and history pagination", async () => {
    await seedLink();
    const notification = await postAdmin("/messages", { title: "Note", body: "Notification body" });
    assert.equal(notification.status, 200);
    const notificationBody = JSON.parse(remoteRequests[0]?.body ?? "{}") as { kind?: string; title?: string };
    assert.equal(notificationBody.kind, undefined);
    assert.equal(notificationBody.title, "Note");
    assert.equal(remoteRequests[0]?.body.includes("humanity-union-author-message-v2"), false);
    const canonical = [
      "humanity-union-author-message",
      remoteRequests[0]?.timestamp,
    ].join("\n");
    assert.equal(remoteRequests[0]?.signature.length, 64);
    assert.equal(canonical.startsWith("humanity-union-author-message\n"), true);

    const chat = await postAdmin("/chat", { body: "Chat body" });
    assert.equal(chat.status, 200);
    const chatBody = JSON.parse(remoteRequests[1]?.body ?? "{}") as { kind?: string; title?: string };
    assert.equal(chatBody.kind, "chat");
    assert.equal(chatBody.title, "");

    const reply = await postReply({ body: VECTOR_BODY });
    assert.equal(reply.status, 200);
    for (let index = 0; index < 20; index += 1) {
      await seedMessage({
        messageId: `15151515-1515-4515-8515-${index.toString(16).padStart(12, "0")}`,
        recipientMemberId: MEMBER,
        recipientExternalAuthorId: AUTHOR,
        direction: "hu_to_im",
        kind: "system",
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        status: "delivered",
      });
    }
    const firstPage = await getHistory({ limit: "20" });
    assert.equal(firstPage.body.data?.messages?.length, 20);
    assert.equal(firstPage.body.data?.pageInfo?.hasMore, true);
    const cursor = firstPage.body.data?.pageInfo?.nextCursor ?? "";
    const secondPage = await getHistory({ limit: "20", cursor });
    assert.equal((secondPage.body.data?.messages?.length ?? 0) > 0, true);
    const ids = [
      ...(firstPage.body.data?.messages ?? []),
      ...(secondPage.body.data?.messages ?? []),
    ].map((row) => row.messageId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.includes(reply.body.data?.messageId), true);
  });

  it("announces one Integrity Media reply to each active administrator", async () => {
    await seedLink();
    enableReplyAnnouncements("Ada Author");
    const messageId = randomUUID();
    const accepted = await postReply({ messageId, body: VECTOR_BODY });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data?.idempotent, false);
    const stored = (await messageStore.list())[0];
    assert.equal(stored?.adminReadAt, undefined);
    assert.equal(await messageStore.countUnreadInboundChats(), 1);
    const first = await inboxRows();
    assert.equal(first.length, 2);
    assert.deepEqual(
      first.map((row) => row.recipientAdminUserId).sort(),
      [ADMIN_ONE, ADMIN_TWO],
    );
    for (const row of first) {
      assert.equal(row.type, "integrity_media_author_message");
      assert.equal(row.title, "Integrity Media author message");
      assert.equal(row.targetLabel, "Ada Author");
      assert.equal(row.actorLabel, undefined);
      assert.equal(row.targetHref, "/admin/integrity-media");
      assert.equal(row.sourceEventId, messageId);
      assert.equal(previewText(row).includes(VECTOR_BODY), false);
      assert.equal(previewText(row).includes(AUTHOR), false);
      assert.equal(previewText(row).includes(MEMBER), false);
      assert.equal(previewText(row).includes(messageId), false);
    }

    const retry = await postReply({ messageId, body: VECTOR_BODY, timestamp: stamp(1) });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.data?.idempotent, true);
    assert.equal((await inboxRows()).length, 2);

    const conflict = await postReply({ messageId, body: "Different text", timestamp: stamp(2) });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "message_conflict");
    assert.equal((await inboxRows()).length, 2);
    assert.equal(await messageStore.countUnreadInboundChats(), 1);
  });

  it("uses Participant when no display name is available and ignores projection failure", async () => {
    await seedLink();
    enableReplyAnnouncements(null);
    const unnamed = await postReply({ body: VECTOR_BODY });
    assert.equal(unnamed.status, 200);
    const rows = await inboxRows();
    assert.equal(rows.length, 2);
    assert.equal(rows.every((row) => row.targetLabel === "Participant"), true);
    assert.equal(rows.every((row) => previewText(row).includes(VECTOR_BODY) === false), true);

    setIntegrityMediaAuthorReplyAnnouncementDepsForTests({
      listActiveAdminUserIds: async () => {
        throw new Error("inbox unavailable");
      },
    });
    const accepted = await postReply({ body: "Still accepted", timestamp: stamp(1) });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data?.idempotent, false);
    assert.equal((await messageStore.list()).length, 2);
    assert.equal(await messageStore.countUnreadInboundChats(), 2);
    assert.equal((await inboxRows()).length, 2);
  });

  it("resolves an accepted reply to its member and hides every other message", async () => {
    await seedLink();
    const accepted = await postReply({ messageId: VECTOR_MESSAGE, body: VECTOR_BODY });
    assert.equal(accepted.status, 200);
    const before = await messageStore.list();
    const resolved = await getReplyTarget(VECTOR_MESSAGE);
    assert.equal(resolved.status, 200);
    assert.deepEqual(resolved.body.data, { memberId: MEMBER });
    assert.equal(JSON.stringify(resolved.body).includes(VECTOR_BODY), false);
    assert.equal(JSON.stringify(resolved.body).includes(AUTHOR), false);
    assert.deepEqual(await messageStore.list(), before);
    assert.equal(await messageStore.countUnreadInboundChats(), 1);

    const outboundId = "99999999-9999-4999-8999-999999999999";
    await seedMessage({
      messageId: outboundId,
      recipientMemberId: MEMBER,
      recipientExternalAuthorId: AUTHOR,
    });
    assert.equal((await getReplyTarget(outboundId)).status, 404);
    assert.equal((await getReplyTarget("not-a-message")).status, 404);
    assert.equal((await getReplyTarget("12121212-1212-4212-8212-121212121299")).status, 404);
    assert.equal((await getReplyTarget(VECTOR_MESSAGE, { memberId: OTHER_MEMBER })).status, 400);

    const mismatchId = "88888888-8888-4888-8888-888888888888";
    await seedMessage({
      messageId: mismatchId,
      recipientMemberId: MEMBER,
      recipientExternalAuthorId: OTHER_AUTHOR,
      direction: "im_to_hu",
      kind: "chat",
      status: "recorded",
      actorMemberId: MEMBER,
    });
    const orphanId = "77777777-7777-4777-8777-777777777777";
    await seedMessage({
      messageId: orphanId,
      recipientMemberId: OTHER_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      direction: "im_to_hu",
      kind: "chat",
      status: "recorded",
      actorMemberId: OTHER_MEMBER,
    });
    assert.equal((await getReplyTarget(mismatchId)).status, 404);
    assert.equal((await getReplyTarget(orphanId)).status, 404);
    assert.equal((await getReplyTarget(VECTOR_MESSAGE)).body.data?.memberId, MEMBER);
  });

  it("refuses reply identity lookup without an administrator", async () => {
    await seedLink();
    const accepted = await postReply({ messageId: VECTOR_MESSAGE, body: VECTOR_BODY });
    assert.equal(accepted.status, 200);
    const anonymous = await fetch(
      `${baseUrl}/api/v1/admin/integrity-media/authors/reply-target?messageId=${VECTOR_MESSAGE}`,
    );
    assert.equal(anonymous.status, 401);

    const now = new Date().toISOString();
    users.set("member-user", {
      userId: "member-user",
      email: "member-user@example.com",
      passwordHash: "not-a-credential",
      displayName: "Member User",
      role: "member",
      status: "active",
      memberId: MEMBER,
      emailVerificationStatus: "verified",
      createdAt: now,
      updatedAt: now,
    });
    const token = createAccessToken({
      sub: "member-user",
      memberId: MEMBER,
      role: "member",
      displayName: "Member User",
      email: "member-user@example.com",
    });
    const member = await fetch(
      `${baseUrl}/api/v1/admin/integrity-media/authors/reply-target?messageId=${VECTOR_MESSAGE}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    assert.equal(member.status, 403);
    assert.equal(await messageStore.countUnreadInboundChats(), 1);
  });
});

function enableReplyAnnouncements(displayName: string | null): void {
  setIntegrityMediaAuthorReplyAnnouncementDepsForTests({
    listActiveAdminUserIds: async () => [ADMIN_ONE, ADMIN_TWO],
  });
  setIntegrityMediaAuthorParticipantResolverForTests(async (memberIds) => {
    const displays = new Map();
    if (displayName) {
      for (const memberId of memberIds) {
        displays.set(memberId, { participantDisplayName: displayName });
      }
    }
    return displays;
  });
}

async function inboxRows(): Promise<
  Array<{
    recipientAdminUserId: string;
    type: string;
    title: string;
    targetLabel?: string;
    actorLabel?: string;
    targetHref?: string;
    sourceEventId?: string;
  }>
> {
  const persistence = resolveAdminNotificationPersistenceAdapter();
  const rows = await Promise.all(
    [ADMIN_ONE, ADMIN_TWO].map((recipientAdminUserId) =>
      persistence.list({ recipientAdminUserId, limit: 20 }),
    ),
  );
  return rows.flat();
}

function previewText(row: {
  title: string;
  targetLabel?: string;
  actorLabel?: string;
  targetHref?: string;
}): string {
  return [row.title, row.targetLabel ?? "", row.actorLabel ?? "", row.targetHref ?? ""].join("\n");
}

function stamp(offsetSeconds: number): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}

function rememberAdmin(): void {
  const now = new Date().toISOString();
  users.set("admin-user", {
    userId: "admin-user",
    email: "admin-user@example.com",
    passwordHash: "not-a-credential",
    displayName: "Test User",
    role: "admin",
    status: "active",
    memberId: ADMIN_MEMBER,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  });
}

async function seedLink(overrides: Partial<ExternalAuthorLinkRecord> = {}): Promise<void> {
  const now = new Date().toISOString();
  await linkStore.insertLink({
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: MEMBER,
    state: "linked",
    linkRevision: 2,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    ...overrides,
  });
}

async function updateLink(patch: Partial<ExternalAuthorLinkRecord>): Promise<void> {
  const current = (await linkStore.listLinks())[0];
  assert.ok(current);
  const updated = await linkStore.updateLink({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(updated, "updated");
}

async function seedMessage(
  overrides: Partial<IntegrityMediaAuthorMessageRecord> &
    Pick<IntegrityMediaAuthorMessageRecord, "messageId" | "recipientMemberId" | "recipientExternalAuthorId">,
): Promise<void> {
  const createdAt = overrides.createdAt ?? new Date().toISOString();
  const inserted = await messageStore.insert({
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    category: "notification",
    title: "Outbound",
    body: "Outbound body",
    cta: null,
    status: "delivered",
    attemptCount: 1,
    lastAttemptAt: createdAt,
    nextAttemptAt: null,
    deliveredAt: createdAt,
    lastErrorCode: null,
    createdAt,
    updatedAt: createdAt,
    direction: "hu_to_im",
    kind: "system",
    ...overrides,
  });
  assert.equal(inserted, "inserted");
}

async function postReply(input: {
  body: string;
  messageId?: string;
  authorId?: string;
  memberId?: string;
  linkRevision?: number;
  replyToMessageId?: string;
  timestamp?: string;
  signature?: string;
  extra?: Record<string, unknown>;
}): Promise<{ status: number; body: ApiBody }> {
  const timestamp = input.timestamp ?? stamp(0);
  const messageId = input.messageId ?? randomUUID();
  const authorId = input.authorId ?? AUTHOR;
  const memberId = input.memberId ?? MEMBER;
  const linkRevision = input.linkRevision ?? 2;
  const replyToMessageId = input.replyToMessageId ?? "";
  const hash = hashIntegrityMediaAuthorReplyContent(input.body.trim());
  const canonical = buildIntegrityMediaAuthorReplyCanonical({
    timestamp,
    messageId,
    authorId,
    memberId,
    linkRevision,
    replyToMessageId,
    contentSha256: hash,
  });
  const payload: Record<string, unknown> = {
    messageId,
    authorId,
    memberId,
    linkRevision,
    body: input.body,
    ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
    ...(input.extra ?? {}),
  };
  const response = await fetch(`${baseUrl}/api/v1/integrations/integrity-media/author-reply`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER]: timestamp,
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER]:
        input.signature ?? signIntegrityMediaAuthorReply(SECRET, canonical),
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function postAdmin(pathSuffix: string, body: Record<string, unknown>): Promise<{ status: number; body: ApiBody }> {
  const token = createAccessToken({
    sub: "admin-user",
    memberId: ADMIN_MEMBER,
    role: "admin",
    displayName: "Test User",
    email: "admin-user@example.com",
  });
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors/${MEMBER}${pathSuffix}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function getReplyTarget(
  messageId: string,
  extraQuery: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const token = createAccessToken({
    sub: "admin-user",
    memberId: ADMIN_MEMBER,
    role: "admin",
    displayName: "Test User",
    email: "admin-user@example.com",
  });
  const params = new URLSearchParams({ messageId, ...extraQuery });
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors/reply-target?${params.toString()}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function getHistory(query: Record<string, string> = {}): Promise<{ status: number; body: ApiBody }> {
  const token = createAccessToken({
    sub: "admin-user",
    memberId: ADMIN_MEMBER,
    role: "admin",
    displayName: "Test User",
    email: "admin-user@example.com",
  });
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors/${MEMBER}/messages${suffix ? `?${suffix}` : ""}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  return { status: response.status, body: (await response.json()) as ApiBody };
}
