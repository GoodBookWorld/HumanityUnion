import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";

import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  isOrdinaryIntegrityMediaCollaborationAllowed,
  resolveIntegrityMediaCollaborationStatus,
} from "../../../src/modules/external-author-link/external-author-link.collaboration.js";
import { isIntegrityMediaAuthorLinkOperational } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import {
  parseIntegrityMediaAuthorMessageDirection,
  parseIntegrityMediaAuthorMessageKind,
  resolveIntegrityMediaAuthorMessageDirection,
  resolveIntegrityMediaAuthorMessageKind,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.contract.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.indexes.js";
import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V2,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.constants.js";
import {
  buildIntegrityMediaAuthorMessageCanonicalString,
  buildIntegrityMediaAuthorMessageCanonicalStringV2,
  buildIntegrityMediaAuthorMessageContentPayload,
  hashIntegrityMediaAuthorMessageContent,
  signIntegrityMediaAuthorMessage,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.hmac.js";
import { reconcilePendingIntegrityMediaAuthorMessages } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.reconciliation.js";
import {
  deriveIntegrityMediaAuthorParticipantDisplay,
  setIntegrityMediaAuthorParticipantResolverForTests,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-directory.service.js";
import integrityMediaAuthorMessageRouter from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.routes.js";
import {
  startIntegrityMediaAuthorMessageScheduler,
  stopIntegrityMediaAuthorMessageScheduler,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.scheduler.js";
import {
  createMemoryIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
  type IntegrityMediaAuthorMessageStore,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import type { IntegrityMediaAuthorMessageRecord } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.types.js";
import {
  setIntegrityMediaAuthorMessageFetchForTests,
  setIntegrityMediaAuthorMessageTransportForTests,
  type IntegrityMediaAuthorMessageHttpRequest,
  type IntegrityMediaAuthorMessageHttpResult,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.transport.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_MEMBER = "11111111-1111-4111-8111-111111111111";
const RECIPIENT_MEMBER = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMBER = "33333333-3333-4333-8333-333333333333";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DISABLED_MEMBER = "44444444-4444-4444-8444-444444444444";
const PENDING_MEMBER = "55555555-5555-4555-8555-555555555555";
const DISABLED_AUTHOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PENDING_AUTHOR = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SECRET = "hu-test-hmac-secret-04c2c-value";
const ORIGIN = "https://integrity.example";
const BODY_MARKER = "plain-body-marker-04c2c";
const TITLE = "A note for the author";

interface ApiBody {
  success: boolean;
  data: {
    messageId?: string;
    status?: string;
    recipientMemberId?: string;
    attemptCount?: number;
    lastErrorCode?: string | null;
    deliveredAt?: string | null;
  } | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let messageStore: IntegrityMediaAuthorMessageStore;
let linkStore: ExternalAuthorLinkStore;
let requests: IntegrityMediaAuthorMessageHttpRequest[];
let transportResult: (
  request: IntegrityMediaAuthorMessageHttpRequest,
) => IntegrityMediaAuthorMessageHttpResult | Promise<IntegrityMediaAuthorMessageHttpResult>;
const users = new Map<string, AuthUserRecord>();
const previousEnv = {
  secret: process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV],
  origin: process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV],
};

describe("Integrity Media outbound author messages", () => {
  before(async () => {
    setAuthUserLookupOverrideForTests(async (userId) => users.get(userId) ?? null);
    const app = express();
    app.use(express.json());
    app.use("/api/v1/admin/integrity-media/authors", integrityMediaAuthorMessageRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind the outbound message test server.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    stopIntegrityMediaAuthorMessageScheduler();
    setAuthUserLookupOverrideForTests(null);
    setIntegrityMediaAuthorParticipantResolverForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorMessageStoreForTests(null);
    setIntegrityMediaAuthorMessageTransportForTests(null);
    setIntegrityMediaAuthorMessageFetchForTests(null);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousEnv.secret);
    restoreEnv(INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV, previousEnv.origin);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    stopIntegrityMediaAuthorMessageScheduler();
    users.clear();
    requests = [];
    transportResult = () => ({ kind: "timeout" });
    messageStore = createMemoryIntegrityMediaAuthorMessageStore();
    linkStore = createMemoryExternalAuthorLinkStore();
    setIntegrityMediaAuthorMessageStoreForTests(messageStore);
    setExternalAuthorLinkStoreForTests(linkStore);
    setIntegrityMediaAuthorMessageTransportForTests(async (request) => {
      requests.push(request);
      return transportResult(request);
    });
    setIntegrityMediaAuthorMessageFetchForTests(null);
    setIntegrityMediaAuthorParticipantResolverForTests(async (memberIds) => {
      const displays = new Map();
      for (const memberId of memberIds) {
        displays.set(
          memberId,
          deriveIntegrityMediaAuthorParticipantDisplay({
            memberId,
            authDisplayName: "Test User",
          }),
        );
      }
      return displays;
    });
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = ORIGIN;
    rememberUser("admin-user", ADMIN_MEMBER, "admin");
    rememberUser("member-user", OTHER_MEMBER, "member");
    rememberUser("moderator-user", OTHER_MEMBER, "moderator");
    rememberUser("institution-user", OTHER_MEMBER, "institution");
  });

  it("rejects an unauthenticated request", async () => {
    const response = await post(RECIPIENT_MEMBER, validBody(), null);
    assert.equal(response.status, 401);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects an ordinary member", async () => {
    const response = await post(RECIPIENT_MEMBER, validBody(), tokenFor("member-user", OTHER_MEMBER, "member"));
    assert.equal(response.status, 403);
    assert.equal(response.body.meta.code, "administrator_required");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a moderator", async () => {
    const response = await post(
      RECIPIENT_MEMBER,
      validBody(),
      tokenFor("moderator-user", OTHER_MEMBER, "moderator"),
    );
    assert.equal(response.status, 403);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects an institution", async () => {
    const response = await post(
      RECIPIENT_MEMBER,
      validBody(),
      tokenFor("institution-user", OTHER_MEMBER, "institution"),
    );
    assert.equal(response.status, 403);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("accepts an admin and does not consult blog editor capability", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.status, "delivered");
    const source = readFileSync(
      path.join(
        here,
        "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(source, /blog-permissions|blog-author-capability|editor-grant/);
  });

  it("resolves the stored external author id for an operational link", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    const remote = JSON.parse(requests[0]?.body ?? "{}") as { recipientAuthorId?: string };
    assert.equal(remote.recipientAuthorId, AUTHOR);
    const row = (await messageStore.list())[0];
    assert.equal(row?.recipientExternalAuthorId, AUTHOR);
    assert.equal(row?.recipientMemberId, RECIPIENT_MEMBER);
  });

  it("rejects a missing link before creating a row", async () => {
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 404);
    assert.equal(response.body.meta.code, "link_missing");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a disabled link before creating a row", async () => {
    await seedLink({ state: "disabled", disconnectedAt: new Date().toISOString() });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "link_disabled");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a pending author activation before creating a row", async () => {
    await seedLink({ authorActivationPending: true });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "author_activation_pending");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("treats a legacy linked row without collaborationStatus as active", async () => {
    await seedLink();
    const stored = (await linkStore.listLinks())[0];
    assert.equal(stored?.collaborationStatus, undefined);
    assert.equal(resolveIntegrityMediaCollaborationStatus(stored ?? {}), "active");
    assert.equal(isOrdinaryIntegrityMediaCollaborationAllowed(stored!), true);
    transportResult = (request) => accepted(request, false);
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.status, "delivered");
    assert.equal(requests.length, 1);
    const listed = directoryAuthors((await listAuthors(adminToken())).body)[0];
    assert.equal(listed?.collaborationStatus, "active");
    assert.equal(listed?.canSend, true);
    assert.equal(listed?.state, "linked");
  });

  it("rejects a blocked collaboration before creating a row or calling Integrity Media", async () => {
    await seedLink({ collaborationStatus: "blocked" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "collaboration_blocked");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
    const listed = directoryAuthors((await listAuthors(adminToken())).body)[0];
    assert.equal(listed?.collaborationStatus, "blocked");
    assert.equal(listed?.canSend, false);
    assert.equal(listed?.state, "linked");
    assert.equal(listed?.authorActivationPending, false);
  });

  it("rejects an archived collaboration before creating a row or calling Integrity Media", async () => {
    await seedLink({ collaborationStatus: "archived" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "collaboration_archived");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
    const listed = directoryAuthors((await listAuthors(adminToken())).body)[0];
    assert.equal(listed?.collaborationStatus, "archived");
    assert.equal(listed?.canSend, false);
    assert.equal(listed?.state, "linked");
  });

  it("rejects a browser-supplied external author id", async () => {
    await seedLink();
    const response = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), externalAuthorId: OTHER_AUTHOR },
      adminToken(),
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.meta.code, "unexpected_field");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects an empty title or body", async () => {
    await seedLink();
    const emptyTitle = await post(RECIPIENT_MEMBER, { ...validBody(), title: "  " }, adminToken());
    const emptyBody = await post(RECIPIENT_MEMBER, { ...validBody(), body: "" }, adminToken());
    assert.equal(emptyTitle.status, 400);
    assert.equal(emptyBody.status, 400);
    assert.equal(emptyTitle.body.meta.code, "invalid_request");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a title longer than 200 characters", async () => {
    await seedLink();
    const tooLong = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), title: "a".repeat(201) },
      adminToken(),
    );
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.meta.code, "payload_too_large");
    transportResult = (request) => accepted(request, false);
    const boundary = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), title: "b".repeat(200) },
      adminToken(),
    );
    assert.equal(boundary.status, 200);
  });

  it("rejects a body longer than 8000 characters", async () => {
    await seedLink();
    const tooLong = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), body: "a".repeat(8001) },
      adminToken(),
    );
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.meta.code, "payload_too_large");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a CTA label longer than 120 characters", async () => {
    await seedLink();
    const response = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), cta: { label: "a".repeat(121), url: "https://integrity.example/join" } },
      adminToken(),
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.meta.code, "payload_too_large");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects a CTA URL longer than 2000 characters", async () => {
    await seedLink();
    const response = await post(
      RECIPIENT_MEMBER,
      {
        ...validBody(),
        cta: { label: "Open", url: `https://integrity.example/${"a".repeat(2000)}` },
      },
      adminToken(),
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.meta.code, "payload_too_large");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("rejects an unsafe CTA URL", async () => {
    await seedLink();
    const response = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), cta: { label: "Open", url: "javascript:alert(1)" } },
      adminToken(),
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.meta.code, "invalid_cta");
    assert.equal((await messageStore.list()).length, 0);
  });

  it("persists the outbound row before the remote request", async () => {
    await seedLink();
    let seen = false;
    transportResult = async (request) => {
      const remote = JSON.parse(request.body) as { messageId: string };
      const row = await messageStore.findByMessageId(remote.messageId);
      assert.ok(row);
      assert.equal(row.status, "pending");
      assert.equal(row.body, BODY_MARKER);
      seen = true;
      return accepted(request, false);
    };
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(seen, true);
    assert.equal(response.body.data?.status, "delivered");
  });

  it("generates one immutable uuid message id", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    const messageId = response.body.data?.messageId ?? "";
    assert.match(
      messageId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    transportResult = (request) => accepted(request, true);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    const remoteIds = requests.map((request) => JSON.parse(request.body).messageId as string);
    assert.deepEqual(remoteIds, [messageId, messageId]);
  });

  it("does not store the secret or signature", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    const signature = requests[0]?.signature ?? "";
    const stored = JSON.stringify({
      rows: await messageStore.list(),
      audits: await messageStore.listAudits(),
    });
    assert.equal(stored.includes(SECRET), false);
    assert.equal(stored.includes(signature), false);
    assert.equal(INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES.some((index) => index.key.messageId === 1 && index.unique), true);
  });

  it("builds the exact canonical string and content hash", () => {
    const content = buildIntegrityMediaAuthorMessageContentPayload({
      body: "Line one\nLine two",
      category: "notification",
      ctaLabel: "Open",
      ctaUrl: "https://integrity.example/join",
      title: "Hello",
    });
    assert.equal(
      content,
      JSON.stringify({
        body: "Line one\nLine two",
        category: "notification",
        ctaLabel: "Open",
        ctaUrl: "https://integrity.example/join",
        title: "Hello",
      }),
    );
    assert.ok(content.indexOf('"body"') < content.indexOf('"category"'));
    assert.ok(content.indexOf('"category"') < content.indexOf('"ctaLabel"'));
    assert.ok(content.indexOf('"ctaLabel"') < content.indexOf('"ctaUrl"'));
    assert.ok(content.indexOf('"ctaUrl"') < content.indexOf('"title"'));
    const hash = hashIntegrityMediaAuthorMessageContent({
      body: "Line one\nLine two",
      category: "notification",
      ctaLabel: "Open",
      ctaUrl: "https://integrity.example/join",
      title: "Hello",
    });
    assert.equal(hash, createHash("sha256").update(content, "utf8").digest("hex"));
    const canonical = buildIntegrityMediaAuthorMessageCanonicalString({
      timestamp: "1700000000",
      messageId: "11111111-1111-4111-8111-111111111111",
      recipientAuthorId: AUTHOR,
      contentSha256: hash,
    });
    assert.equal(
      canonical,
      [
        "humanity-union-author-message",
        "1700000000",
        "11111111-1111-4111-8111-111111111111",
        AUTHOR,
        hash,
      ].join("\n"),
    );
    assert.equal(canonical.split("\n")[0], INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE);
    assert.equal(canonical.split("\n").includes("Line one\nLine two"), false);
  });

  it("hashes an absent CTA as empty label and url", () => {
    const content = buildIntegrityMediaAuthorMessageContentPayload({
      body: BODY_MARKER,
      category: "notification",
      ctaLabel: "",
      ctaUrl: "",
      title: TITLE,
    });
    assert.equal(content.includes('"ctaLabel":""'), true);
    assert.equal(content.includes('"ctaUrl":""'), true);
  });

  it("changes the signature when the timestamp or content changes", () => {
    const first = signed("1700000000", TITLE);
    const laterSignature = signed("1700000060", TITLE);
    const edited = signed("1700000000", "Edited title");
    assert.notEqual(first.signature, laterSignature.signature);
    assert.notEqual(first.hash, edited.hash);
    assert.notEqual(first.signature, edited.signature);
    assert.equal(
      first.signature,
      createHmac("sha256", SECRET).update(first.canonical).digest("hex"),
    );
  });

  it("signs the live request with the contract headers and no CTA", async () => {
    await seedLink();
    const seen: { headers?: Headers; body?: string } = {};
    setIntegrityMediaAuthorMessageTransportForTests(null);
    setIntegrityMediaAuthorMessageFetchForTests(async (_url, init) => {
      seen.headers = new Headers(init?.headers);
      seen.body = String(init?.body ?? "");
      const remote = JSON.parse(seen.body) as {
        messageId: string;
        recipientAuthorId: string;
      };
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            messageId: remote.messageId,
            recipientAuthorId: remote.recipientAuthorId,
            idempotent: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "delivered");
    const remote = JSON.parse(seen.body ?? "{}") as {
      messageId: string;
      recipientAuthorId: string;
      category: string;
      cta?: unknown;
      source?: unknown;
      title: string;
      body: string;
    };
    assert.equal(remote.cta, undefined);
    assert.equal(remote.source, undefined);
    assert.equal(remote.category, "notification");
    assert.equal(remote.recipientAuthorId, AUTHOR);
    const timestamp = seen.headers?.get(INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER) ?? "";
    const signature = seen.headers?.get(INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER) ?? "";
    assert.match(timestamp, /^\d{10}$/);
    assert.equal(signature, independentSignature({
      timestamp,
      messageId: remote.messageId,
      recipientAuthorId: remote.recipientAuthorId,
      title: remote.title,
      body: remote.body,
      ctaLabel: "",
      ctaUrl: "",
    }));
  });

  it("marks idempotent false and true as delivered", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const created = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(created.body.data?.status, "delivered");
    assert.equal(created.body.data?.lastErrorCode ?? null, null);
    transportResult = (request) => accepted(request, true);
    const replay = await post(RECIPIENT_MEMBER, { ...validBody(), title: "Second note" }, adminToken());
    assert.equal(replay.body.data?.status, "delivered");
    const rows = await messageStore.list();
    assert.equal(rows.filter((row) => row.status === "delivered").length, 2);
  });

  it("does not deliver a malformed success response", async () => {
    await seedLink();
    transportResult = () => ({ kind: "response", status: 200, body: "{\"success\":true}" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 202);
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "malformed_response");
  });

  it("does not deliver a mismatched message id", async () => {
    await seedLink();
    transportResult = (request) => {
      const remote = JSON.parse(request.body) as { recipientAuthorId: string };
      return {
        kind: "response",
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            messageId: randomUUID(),
            recipientAuthorId: remote.recipientAuthorId,
            idempotent: false,
          },
        }),
      };
    };
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "response_mismatch");
  });

  it("does not deliver a mismatched recipient author id", async () => {
    await seedLink();
    transportResult = (request) => {
      const remote = JSON.parse(request.body) as { messageId: string };
      return {
        kind: "response",
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            messageId: remote.messageId,
            recipientAuthorId: OTHER_AUTHOR,
            idempotent: false,
          },
        }),
      };
    };
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "response_mismatch");
  });

  it("keeps a timeout pending and retries the same id with a new signature", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 202);
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "timeout");
    transportResult = (request) => accepted(request, false);
    const retried = await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(retried.delivered, 1);
    assert.equal(requests.length, 2);
    assert.equal(JSON.parse(requests[0]?.body ?? "{}").messageId, JSON.parse(requests[1]?.body ?? "{}").messageId);
    assert.notEqual(requests[0]?.timestamp, requests[1]?.timestamp);
    assert.notEqual(requests[0]?.signature, requests[1]?.signature);
    const row = (await messageStore.list())[0];
    assert.equal(row?.status, "delivered");
    const callsBefore = requests.length;
    await reconcilePendingIntegrityMediaAuthorMessages({ now: new Date(Date.now() + 86_400_000) });
    assert.equal(requests.length, callsBefore);
  });

  it("keeps a network failure pending", async () => {
    await seedLink();
    transportResult = () => ({ kind: "network" });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "network");
  });

  it("keeps an Integrity Media 503 pending", async () => {
    await seedLink();
    transportResult = () => ({
      kind: "response",
      status: 503,
      body: JSON.stringify({ success: false, error: "unavailable" }),
    });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "pending");
    assert.equal(response.body.data?.lastErrorCode, "unavailable");
  });

  it("fails a remote 400 without another attempt", async () => {
    await assertPermanentRemoteFailure(400, "invalid_request");
  });

  it("fails a remote 401 without another attempt", async () => {
    await assertPermanentRemoteFailure(401, "invalid_signature");
  });

  it("fails a message conflict without another attempt", async () => {
    await assertPermanentRemoteFailure(409, "message_conflict");
  });

  it("fails link_ineligible without another attempt", async () => {
    await assertPermanentRemoteFailure(409, "link_ineligible");
  });

  it("recovers a pending row by reconciliation", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    transportResult = (request) => accepted(request, false);
    const result = await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(result.examined, 1);
    assert.equal(result.delivered, 1);
    assert.equal((await messageStore.list())[0]?.status, "delivered");
  });

  it("converges through idempotent true after a local write failure", async () => {
    await seedLink();
    const memory = messageStore;
    let failures = 1;
    setIntegrityMediaAuthorMessageStoreForTests({
      ...memory,
      markDelivered: async (input) => {
        if (failures > 0) {
          failures -= 1;
          throw new Error("process stopped after the remote write");
        }
        return memory.markDelivered(input);
      },
    });
    let calls = 0;
    transportResult = (request) => {
      calls += 1;
      return accepted(request, calls > 1);
    };
    const first = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(first.body.data?.status, "pending");
    const second = await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(second.delivered, 1);
    assert.equal((await memory.list())[0]?.status, "delivered");
    const ids = requests.map((request) => JSON.parse(request.body).messageId as string);
    assert.equal(ids[0], ids[1]);
    assert.equal(calls, 2);
  });

  it("does not let concurrent reconciliation send the same row twice", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    let sends = 0;
    transportResult = async (request) => {
      sends += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return accepted(request, false);
    };
    const now = later();
    const [first, second] = await Promise.all([
      reconcilePendingIntegrityMediaAuthorMessages({ now }),
      reconcilePendingIntegrityMediaAuthorMessages({ now }),
    ]);
    assert.equal(sends, 1);
    assert.equal(first.examined + second.examined, 1);
    assert.equal((await messageStore.list())[0]?.status, "delivered");
  });

  it("keeps the message body and secret out of the audit trail", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    const audits = await messageStore.listAudits();
    const dumped = JSON.stringify(audits);
    assert.equal(dumped.includes(BODY_MARKER), false);
    assert.equal(dumped.includes(SECRET), false);
    assert.equal(dumped.includes(requests[0]?.signature ?? "missing-signature"), false);
    assert.deepEqual(
      audits.map((audit) => audit.action),
      ["integrity_media_message_requested", "integrity_media_message_delivered"],
    );
  });

  it("does not record a permanent failure for a transient retry", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    await post(RECIPIENT_MEMBER, validBody(), adminToken());
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    const actions = (await messageStore.listAudits()).map((audit) => audit.action);
    assert.deepEqual(actions, ["integrity_media_message_requested"]);
    assert.equal(actions.includes("integrity_media_message_failed"), false);
  });

  it("records a permanent failure once", async () => {
    await seedLink();
    transportResult = () => ({
      kind: "response",
      status: 409,
      body: JSON.stringify({ success: false, error: "link_ineligible" }),
    });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.body.data?.status, "failed");
    const actions = (await messageStore.listAudits()).map((audit) => audit.action);
    assert.deepEqual(actions, [
      "integrity_media_message_requested",
      "integrity_media_message_failed",
    ]);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 1);
  });

  it("signs a CTA into the content hash and omits member identity", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    await post(
      RECIPIENT_MEMBER,
      { ...validBody(), cta: { label: "Open", url: "https://integrity.example/join" } },
      adminToken(),
    );
    const request = requests[0];
    assert.ok(request);
    const remote = JSON.parse(request.body) as {
      messageId: string;
      recipientAuthorId: string;
      title: string;
      body: string;
      cta: { label: string; url: string };
      actorMemberId?: string;
    };
    assert.equal(remote.actorMemberId, undefined);
    assert.equal(remote.cta.label, "Open");
    assert.equal(
      request.signature,
      independentSignature({
        timestamp: request.timestamp,
        messageId: remote.messageId,
        recipientAuthorId: remote.recipientAuthorId,
        title: remote.title,
        body: remote.body,
        ctaLabel: "Open",
        ctaUrl: "https://integrity.example/join",
      }),
    );
    assert.equal(request.timeoutMs, INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS);
    assert.equal(
      request.url,
      "https://integrity.example/api/integrations/humanity-union/author-messages",
    );
  });

  it("keeps the identity-link purpose and operational rule unchanged", () => {
    assert.equal(INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE, "integrity-media-link-redeem");
    assert.equal(
      isIntegrityMediaAuthorLinkOperational({ state: "linked", authorActivationPending: true }),
      false,
    );
    assert.equal(isIntegrityMediaAuthorLinkOperational({ state: "linked" }), true);
    assert.equal(isIntegrityMediaAuthorLinkOperational({ state: "disabled" }), false);
    assert.equal(INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS, 60_000);
  });

  it("rejects an unauthenticated author list", async () => {
    const response = await listAuthors(null);
    assert.equal(response.status, 401);
  });

  it("rejects an ordinary member from the author list", async () => {
    const response = await listAuthors(tokenFor("member-user", OTHER_MEMBER, "member"));
    assert.equal(response.status, 403);
    assert.equal(response.body.meta.code, "administrator_required");
  });

  it("rejects a moderator from the author list", async () => {
    const response = await listAuthors(tokenFor("moderator-user", OTHER_MEMBER, "moderator"));
    assert.equal(response.status, 403);
  });

  it("lists linked, disabled, and setup-pending collaborations for an admin", async () => {
    await seedDirectory();
    const response = await listAuthors(adminToken(), { state: "all", limit: "25", offset: "0" });
    assert.equal(response.status, 200);
    const authors = directoryAuthors(response.body);
    assert.equal(authors.length, 3);
    assert.equal(response.body.data?.total, 3);
    assert.equal(response.body.data?.hasMore, false);
    assert.deepEqual(
      authors.map((row) => row.memberId),
      [RECIPIENT_MEMBER, PENDING_MEMBER, DISABLED_MEMBER],
    );
    assert.equal(authors[0]?.canSend, true);
    assert.equal(authors[0]?.collaborationStatus, "active");
    assert.equal(authors[1]?.authorActivationPending, true);
    assert.equal(authors[1]?.canSend, false);
    assert.equal(authors[1]?.collaborationStatus, "active");
    assert.equal(authors[2]?.state, "disabled");
    assert.equal(authors[2]?.canSend, false);
    assert.equal(authors[2]?.collaborationStatus, "active");
    assert.equal(authors[0]?.messageCount, 2);
    assert.equal(authors[0]?.latestMessage?.title, "Newer note");
    assert.equal(authors[0]?.latestMessage?.status, "delivered");
    const serialized = JSON.stringify(response.body);
    assert.equal(serialized.includes(BODY_MARKER), false);
    assert.equal(serialized.includes("\"cta\""), false);
    assert.equal(serialized.includes("\"email\""), false);
    assert.equal(serialized.includes(SECRET), false);
    assert.equal(serialized.includes("signature"), false);
    assert.equal(serialized.includes("passwordHash"), false);
  });

  it("filters the author list by connection state", async () => {
    await seedDirectory();
    const linked = directoryAuthors((await listAuthors(adminToken(), { state: "linked" })).body);
    const disabled = directoryAuthors((await listAuthors(adminToken(), { state: "disabled" })).body);
    const pending = directoryAuthors(
      (await listAuthors(adminToken(), { state: "setup_pending" })).body,
    );
    assert.deepEqual(linked.map((row) => row.memberId), [RECIPIENT_MEMBER]);
    assert.equal(linked[0]?.canSend, true);
    assert.deepEqual(disabled.map((row) => row.memberId), [DISABLED_MEMBER]);
    assert.deepEqual(pending.map((row) => row.memberId), [PENDING_MEMBER]);
  });

  it("paginates the author list with total and hasMore", async () => {
    await seedDirectory();
    const first = await listAuthors(adminToken(), { limit: "1", offset: "0" });
    const last = await listAuthors(adminToken(), { limit: "1", offset: "2" });
    assert.equal(first.body.data?.total, 3);
    assert.equal(first.body.data?.hasMore, true);
    assert.equal(directoryAuthors(first.body)[0]?.memberId, RECIPIENT_MEMBER);
    assert.equal(last.body.data?.hasMore, false);
    assert.equal(directoryAuthors(last.body)[0]?.memberId, DISABLED_MEMBER);
  });

  it("derives participant display data without email", async () => {
    const display = deriveIntegrityMediaAuthorParticipantDisplay({
      memberId: RECIPIENT_MEMBER,
      authDisplayName: "admin@example.com",
      profileDisplayName: "Ada Lovelace",
      publicName: "ada",
      avatarUrl: "https://cdn.example/ada.png",
    });
    assert.equal(display.participantDisplayName, "Ada Lovelace");
    assert.equal(display.participantAvatarUrl, "https://cdn.example/ada.png");
    assert.equal(
      display.participantProfileHref,
      `/admin/participants/${RECIPIENT_MEMBER}/public-profile`,
    );
    assert.equal(JSON.stringify(display).includes("@"), false);

    const emailOnly = deriveIntegrityMediaAuthorParticipantDisplay({
      memberId: RECIPIENT_MEMBER,
      authDisplayName: "person@example.com",
    });
    assert.equal(emailOnly.participantDisplayName, "Participant");
    assert.equal(emailOnly.participantProfileHref, undefined);

    setIntegrityMediaAuthorParticipantResolverForTests(async () => {
      return new Map([[RECIPIENT_MEMBER, display]]);
    });
    await seedLink({
      externalAuthorId: AUTHOR,
      memberId: RECIPIENT_MEMBER,
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    const response = await listAuthors(adminToken());
    const row = directoryAuthors(response.body)[0];
    assert.equal(row?.participantDisplayName, "Ada Lovelace");
    assert.equal(row?.participantAvatarUrl, "https://cdn.example/ada.png");
    assert.equal(JSON.stringify(response.body).includes("email"), false);
  });

  it("starts the message scheduler without starting a second timer", () => {
    startIntegrityMediaAuthorMessageScheduler();
    startIntegrityMediaAuthorMessageScheduler();
    stopIntegrityMediaAuthorMessageScheduler();
  });

  it("normalizes a legacy notification to hu_to_im system without rewriting it", async () => {
    await seedLink();
    const messageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
    await seedMessage({
      messageId,
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Legacy title",
      body: "Legacy body",
      cta: { label: "Read", url: "https://example.com/legacy" },
      actorMemberId: ADMIN_MEMBER,
      status: "delivered",
      deliveredAt: "2026-04-01T00:00:01.000Z",
      createdAt: "2026-04-01T00:00:01.000Z",
    });
    const stored = await messageStore.findByMessageId(messageId);
    assert.equal(stored?.direction, undefined);
    assert.equal(stored?.kind, undefined);
    assert.equal(stored?.messageId, messageId);
    assert.equal(resolveIntegrityMediaAuthorMessageDirection(stored?.direction), "hu_to_im");
    assert.equal(resolveIntegrityMediaAuthorMessageKind(stored?.kind), "system");

    const response = await getHistory(RECIPIENT_MEMBER, adminToken());
    assert.equal(response.status, 200);
    const message = response.body.data?.messages?.[0];
    assert.equal(message?.messageId, messageId);
    assert.equal(message?.direction, "hu_to_im");
    assert.equal(message?.kind, "system");
    assert.equal(message?.title, "Legacy title");
    assert.equal(message?.body, "Legacy body");
    assert.deepEqual(message?.cta, { label: "Read", url: "https://example.com/legacy" });
    assert.equal(message?.actorMemberId, ADMIN_MEMBER);
    assert.equal(message?.createdAt, "2026-04-01T00:00:01.000Z");
    assert.equal(message?.delivery?.status, "delivered");
    assert.equal(message?.delivery?.deliveredAt, "2026-04-01T00:00:01.000Z");
    assert.equal(JSON.stringify(response.body).includes(SECRET), false);
    const after = await messageStore.findByMessageId(messageId);
    assert.equal(after?.direction, undefined);
    assert.equal(after?.title, "Legacy title");
  });

  it("accepts only the direction and kind values and rejects anything else", () => {
    assert.equal(parseIntegrityMediaAuthorMessageDirection("hu_to_im"), "hu_to_im");
    assert.equal(parseIntegrityMediaAuthorMessageDirection("im_to_hu"), "im_to_hu");
    assert.equal(parseIntegrityMediaAuthorMessageDirection("chat"), null);
    assert.equal(parseIntegrityMediaAuthorMessageDirection(undefined), null);
    assert.equal(parseIntegrityMediaAuthorMessageKind("chat"), "chat");
    assert.equal(parseIntegrityMediaAuthorMessageKind("system"), "system");
    assert.equal(parseIntegrityMediaAuthorMessageKind("notification"), null);
  });

  it("returns one identity pair in oldest-to-newest order and does not leak another author", async () => {
    await seedLink();
    await seedLink({
      memberId: OTHER_MEMBER,
      externalAuthorId: OTHER_AUTHOR,
    });
    await seedMessage({
      messageId: historyId(1),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "First",
      body: "one",
      createdAt: historyTime(1),
    });
    await seedMessage({
      messageId: historyId(2),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Second",
      body: "two",
      createdAt: historyTime(2),
    });
    await seedMessage({
      messageId: historyId(3),
      recipientMemberId: OTHER_MEMBER,
      recipientExternalAuthorId: OTHER_AUTHOR,
      title: "Other",
      body: "secret-other-body",
      createdAt: historyTime(3),
    });

    const response = await getHistory(RECIPIENT_MEMBER, adminToken());
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data?.messages?.map((message) => message.messageId),
      [historyId(1), historyId(2)],
    );
    assert.equal(JSON.stringify(response.body).includes("secret-other-body"), false);
    assert.equal(JSON.stringify(response.body).includes(OTHER_AUTHOR), false);
  });

  it("pages the newest 20 without duplicating or skipping, including equal timestamps", async () => {
    await seedLink();
    for (let index = 1; index <= 25; index += 1) {
      await seedMessage({
        messageId: historyId(index),
        recipientMemberId: RECIPIENT_MEMBER,
        recipientExternalAuthorId: AUTHOR,
        title: `Note ${index}`,
        body: `body-${index}`,
        createdAt: historyTime(index),
      });
    }

    const first = await getHistory(RECIPIENT_MEMBER, adminToken());
    assert.equal(first.status, 200);
    assert.equal(first.body.data?.messages?.length, 20);
    assert.equal(first.body.data?.pageInfo?.hasMore, true);
    assert.deepEqual(
      first.body.data?.messages?.map((message) => message.messageId),
      Array.from({ length: 20 }, (_, index) => historyId(index + 6)),
    );
    const cursor = first.body.data?.pageInfo?.nextCursor;
    assert.equal(typeof cursor, "string");
    const second = await getHistory(RECIPIENT_MEMBER, adminToken(), { cursor: cursor ?? "" });
    assert.equal(second.body.data?.pageInfo?.hasMore, false);
    assert.equal(second.body.data?.pageInfo?.nextCursor, null);
    assert.deepEqual(
      second.body.data?.messages?.map((message) => message.messageId),
      [historyId(1), historyId(2), historyId(3), historyId(4), historyId(5)],
    );
    const combined = [
      ...(second.body.data?.messages ?? []),
      ...(first.body.data?.messages ?? []),
    ].map((message) => message.messageId);
    assert.deepEqual(
      combined,
      Array.from({ length: 25 }, (_, index) => historyId(index + 1)),
    );

    const sameTime = "2026-05-01T00:00:00.000Z";
    for (const id of [historyId(31), historyId(32), historyId(33)]) {
      await seedMessage({
        messageId: id,
        recipientMemberId: RECIPIENT_MEMBER,
        recipientExternalAuthorId: AUTHOR,
        title: "Tie",
        body: id,
        createdAt: sameTime,
      });
    }
    const ties = await getHistory(RECIPIENT_MEMBER, adminToken(), { limit: "2" });
    assert.deepEqual(
      ties.body.data?.messages?.map((message) => message.messageId),
      [historyId(32), historyId(33)],
    );
    const olderTies = await getHistory(RECIPIENT_MEMBER, adminToken(), {
      limit: "2",
      cursor: ties.body.data?.pageInfo?.nextCursor ?? "",
    });
    assert.deepEqual(
      olderTies.body.data?.messages?.map((message) => message.messageId),
      [historyId(25), historyId(31)],
    );
  });

  it("keeps history readable when the link is disabled, blocked, or archived", async () => {
    await seedMessage({
      messageId: historyId(41),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Still here",
      body: "kept",
      createdAt: historyTime(1),
    });
    await seedLink({ state: "disabled", disconnectedAt: historyTime(2) });
    const disabled = await getHistory(RECIPIENT_MEMBER, adminToken());
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data?.messages?.[0]?.messageId, historyId(41));

    await seedLink({
      memberId: OTHER_MEMBER,
      externalAuthorId: OTHER_AUTHOR,
      collaborationStatus: "blocked",
    });
    await seedMessage({
      messageId: historyId(42),
      recipientMemberId: OTHER_MEMBER,
      recipientExternalAuthorId: OTHER_AUTHOR,
      title: "Blocked",
      body: "blocked-body",
      createdAt: historyTime(2),
    });
    const blocked = await getHistory(OTHER_MEMBER, adminToken());
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.data?.messages?.[0]?.body, "blocked-body");

    const archivedMember = "66666666-6666-4666-8666-666666666666";
    const archivedAuthor = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await seedLink({
      memberId: archivedMember,
      externalAuthorId: archivedAuthor,
      collaborationStatus: "archived",
    });
    await seedMessage({
      messageId: historyId(43),
      recipientMemberId: archivedMember,
      recipientExternalAuthorId: archivedAuthor,
      title: "Archived",
      body: "archived-body",
      createdAt: historyTime(3),
    });
    const archived = await getHistory(archivedMember, adminToken());
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data?.messages?.[0]?.body, "archived-body");
  });

  it("keeps admin send on hu_to_im system and rejects a browser-supplied inbound direction", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const sent = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(sent.status, 200);
    const stored = (await messageStore.list())[0];
    assert.equal(stored?.direction, "hu_to_im");
    assert.equal(stored?.kind, "system");
    assert.equal(requests[0]?.body.includes("direction"), false);
    assert.equal(requests[0]?.body.includes("im_to_hu"), false);

    const spoofed = await post(
      RECIPIENT_MEMBER,
      { ...validBody(), direction: "im_to_hu", kind: "chat" },
      adminToken(),
    );
    assert.equal(spoofed.status, 400);
    assert.equal(spoofed.body.meta.code, "unexpected_field");
    assert.equal((await messageStore.list()).length, 1);
    assert.equal((await messageStore.list())[0]?.direction, "hu_to_im");
  });

  it("does not let the outbound scheduler claim an inbound message", async () => {
    await seedLink();
    await seedMessage({
      messageId: historyId(51),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Inbound",
      body: "from-im",
      createdAt: historyTime(1),
      direction: "im_to_hu",
      kind: "chat",
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: null,
    });
    await seedMessage({
      messageId: historyId(52),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Outbound",
      body: "from-hu",
      createdAt: historyTime(2),
      direction: "hu_to_im",
      kind: "system",
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: null,
    });
    transportResult = () => ({ kind: "timeout" });
    await reconcilePendingIntegrityMediaAuthorMessages({ now: new Date(historyTime(10)) });
    assert.equal(requests.length, 1);
    const inbound = await messageStore.findByMessageId(historyId(51));
    const outbound = await messageStore.findByMessageId(historyId(52));
    assert.equal(inbound?.attemptCount, 0);
    assert.equal(inbound?.status, "pending");
    assert.equal(outbound?.attemptCount, 1);
    const history = await getHistory(RECIPIENT_MEMBER, adminToken());
    const inboundView = history.body.data?.messages?.find((message) => message.messageId === historyId(51));
    assert.equal(inboundView?.direction, "im_to_hu");
    assert.equal(inboundView?.kind, "chat");
    assert.equal(inboundView?.delivery, null);
  });

  it("requires an administrator to read message history", async () => {
    await seedLink();
    const missing = await getHistory(RECIPIENT_MEMBER, null);
    assert.equal(missing.status, 401);
    const member = await getHistory(
      RECIPIENT_MEMBER,
      tokenFor("member-user", OTHER_MEMBER, "member"),
    );
    assert.equal(member.status, 403);
    assert.equal(member.body.meta.code, "administrator_required");
    const spoofedAuthor = await getHistory(RECIPIENT_MEMBER, adminToken(), {
      externalAuthorId: OTHER_AUTHOR,
    });
    assert.equal(spoofedAuthor.status, 400);
    assert.equal(spoofedAuthor.body.meta.code, "unexpected_field");
    assert.equal(
      INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES.some(
        (index) =>
          index.name === "integrity_media_author_messages_pair_history" &&
          index.key.recipientExternalAuthorId === 1 &&
          index.key.messageId === -1,
      ),
      true,
    );
  });

  it("builds the v2 canonical string without putting kind in the content hash", () => {
    const content = buildIntegrityMediaAuthorMessageContentPayload({
      body: "Chat line",
      category: "notification",
      ctaLabel: "",
      ctaUrl: "",
      title: "",
    });
    assert.equal(
      content,
      JSON.stringify({
        body: "Chat line",
        category: "notification",
        ctaLabel: "",
        ctaUrl: "",
        title: "",
      }),
    );
    assert.equal(content.includes("kind"), false);
    const hash = hashIntegrityMediaAuthorMessageContent({
      body: "Chat line",
      category: "notification",
      ctaLabel: "",
      ctaUrl: "",
      title: "",
    });
    const canonical = buildIntegrityMediaAuthorMessageCanonicalStringV2({
      timestamp: "1700000000",
      messageId: "11111111-1111-4111-8111-111111111111",
      recipientAuthorId: AUTHOR,
      kind: "chat",
      contentSha256: hash,
    });
    assert.equal(
      canonical,
      [
        "humanity-union-author-message-v2",
        "1700000000",
        "11111111-1111-4111-8111-111111111111",
        AUTHOR,
        "chat",
        hash,
      ].join("\n"),
    );
    assert.equal(canonical.split("\n")[0], INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE_V2);
    assert.equal(canonical.split("\n").length, 6);
    assert.notEqual(canonical.split("\n")[0], INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE);
  });

  it("rejects chat from an unauthenticated caller and from a non-admin", async () => {
    await seedLink();
    const anonymous = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, null);
    assert.equal(anonymous.status, 401);
    const member = await postChat(
      RECIPIENT_MEMBER,
      { body: "Hello author" },
      tokenFor("member-user", OTHER_MEMBER, "member"),
    );
    assert.equal(member.status, 403);
    assert.equal(member.body.meta.code, "administrator_required");
    assert.equal((await messageStore.list()).length, 0);
    assert.equal(requests.length, 0);
  });

  it("requires a non-empty chat body and does not require a title or CTA", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const missing = await postChat(RECIPIENT_MEMBER, {}, adminToken());
    assert.equal(missing.status, 400);
    assert.equal(missing.body.meta.code, "invalid_request");
    const blank = await postChat(RECIPIENT_MEMBER, { body: " \n\t " }, adminToken());
    assert.equal(blank.status, 400);
    assert.equal(blank.body.meta.code, "invalid_request");
    const markup = await postChat(RECIPIENT_MEMBER, { body: "<b>hello</b>" }, adminToken());
    assert.equal(markup.status, 400);
    const tooLong = await postChat(
      RECIPIENT_MEMBER,
      { body: "a".repeat(INTEGRITY_MEDIA_AUTHOR_MESSAGE_BODY_MAX_LENGTH + 1) },
      adminToken(),
    );
    assert.equal(tooLong.status, 400);
    assert.equal(tooLong.body.meta.code, "payload_too_large");
    assert.equal((await messageStore.list()).length, 0);
    const created = await postChat(RECIPIENT_MEMBER, { body: "  Hello author  " }, adminToken());
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.status, "delivered");
    const stored = (await messageStore.list())[0];
    assert.equal(stored?.title, "");
    assert.equal(stored?.cta, null);
    assert.equal(stored?.body, "Hello author");
    assert.equal(stored?.direction, "hu_to_im");
    assert.equal(stored?.kind, "chat");
    assert.equal(stored?.category, "notification");
    const remote = JSON.parse(requests[0]?.body ?? "{}") as {
      title?: string;
      kind?: string;
      cta?: unknown;
      category?: string;
      recipientAuthorId?: string;
    };
    assert.equal(remote.title, "");
    assert.equal(remote.kind, "chat");
    assert.equal(remote.cta, undefined);
    assert.equal(remote.category, "notification");
    assert.equal(remote.recipientAuthorId, AUTHOR);
  });

  it("rejects a browser attempt to choose direction, kind, or the recipient author", async () => {
    await seedLink();
    const spoofed = await postChat(
      RECIPIENT_MEMBER,
      {
        body: "Hello author",
        direction: "im_to_hu",
        kind: "system",
        authorId: OTHER_AUTHOR,
        recipientAuthorId: OTHER_AUTHOR,
        linkRevision: 2,
        status: "delivered",
      },
      adminToken(),
    );
    assert.equal(spoofed.status, 400);
    assert.equal(spoofed.body.meta.code, "unexpected_field");
    assert.equal((await messageStore.list()).length, 0);
    assert.equal(requests.length, 0);
  });

  it("signs chat with HMAC v2 and leaves the notification payload on v1", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const chat = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    assert.equal(chat.status, 200);
    const chatRequest = requests[0]!;
    const chatRemote = JSON.parse(chatRequest.body) as {
      messageId: string;
      recipientAuthorId: string;
      title: string;
      body: string;
      kind?: string;
      category: string;
    };
    assert.equal(chatRemote.kind, "chat");
    assert.equal(
      chatRequest.signature,
      chatSignature({
        timestamp: chatRequest.timestamp,
        messageId: chatRemote.messageId,
        recipientAuthorId: chatRemote.recipientAuthorId,
        body: chatRemote.body,
        title: chatRemote.title,
      }),
    );
    assert.notEqual(
      chatRequest.signature,
      independentSignature({
        timestamp: chatRequest.timestamp,
        messageId: chatRemote.messageId,
        recipientAuthorId: chatRemote.recipientAuthorId,
        title: chatRemote.title,
        body: chatRemote.body,
        ctaLabel: "",
        ctaUrl: "",
      }),
    );
    const notification = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(notification.status, 200);
    const notificationRequest = requests[1]!;
    const notificationRemote = JSON.parse(notificationRequest.body) as {
      messageId: string;
      recipientAuthorId: string;
      title: string;
      body: string;
      kind?: string;
    };
    assert.equal(notificationRemote.kind, undefined);
    assert.equal(notificationRequest.body.includes('"kind"'), false);
    assert.equal(
      notificationRequest.signature,
      independentSignature({
        timestamp: notificationRequest.timestamp,
        messageId: notificationRemote.messageId,
        recipientAuthorId: notificationRemote.recipientAuthorId,
        title: notificationRemote.title,
        body: notificationRemote.body,
        ctaLabel: "",
        ctaUrl: "",
      }),
    );
    const rows = await messageStore.list();
    assert.equal(rows.length, 2);
    assert.equal(MONGO_COLLECTIONS.integrityMediaAuthorMessages, "integrity_media_author_messages");
    const storeSource = readFileSync(
      path.join(
        here,
        "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.ts",
      ),
      "utf8",
    );
    assert.match(storeSource, /MONGO_COLLECTIONS\.integrityMediaAuthorMessages/);
    assert.doesNotMatch(storeSource, /integrity_media_author_chats|author_conversations/);
  });

  it("retries chat with the same message id and still signs notifications as v1 after a later block", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    const chat = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    const chatId = chat.body.data?.messageId ?? "";
    assert.match(chatId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(requests.length, 1);
    transportResult = (request) => accepted(request, true);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 2);
    const retried = JSON.parse(requests[1]?.body ?? "{}") as { messageId?: string; kind?: string };
    assert.equal(retried.messageId, chatId);
    assert.equal(retried.kind, "chat");
    assert.equal((await messageStore.findByMessageId(chatId))?.status, "delivered");

    transportResult = () => ({ kind: "timeout" });
    const notification = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    const notificationId = notification.body.data?.messageId ?? "";
    assert.equal(requests.length, 3);
    await updateCurrentLink({ collaborationStatus: "blocked" });
    transportResult = (request) => accepted(request, false);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 4);
    const legacy = JSON.parse(requests[3]?.body ?? "{}") as {
      messageId?: string;
      kind?: string;
      title?: string;
      body?: string;
      recipientAuthorId?: string;
    };
    assert.equal(legacy.messageId, notificationId);
    assert.equal(legacy.kind, undefined);
    assert.equal(requests[3]?.body.includes('"kind"'), false);
    assert.equal(
      requests[3]?.signature,
      independentSignature({
        timestamp: requests[3]?.timestamp ?? "",
        messageId: legacy.messageId ?? "",
        recipientAuthorId: legacy.recipientAuthorId ?? "",
        title: legacy.title ?? "",
        body: legacy.body ?? "",
        ctaLabel: "",
        ctaUrl: "",
      }),
    );
    assert.equal((await messageStore.findByMessageId(notificationId))?.kind, "system");
    assert.equal((await messageStore.findByMessageId(notificationId))?.status, "delivered");
    assert.equal((await messageStore.findByMessageId(chatId))?.kind, "chat");
  });

  it("does not deliver a queued chat after block, disconnect, or pending activation", async () => {
    await seedLink();
    transportResult = () => ({ kind: "timeout" });
    const blocked = await postChat(RECIPIENT_MEMBER, { body: "Before block" }, adminToken());
    const blockedId = blocked.body.data?.messageId ?? "";
    await updateCurrentLink({ collaborationStatus: "blocked" });
    transportResult = (request) => accepted(request, false);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 1);
    assert.equal((await messageStore.findByMessageId(blockedId))?.status, "failed");
    assert.equal((await messageStore.findByMessageId(blockedId))?.lastErrorCode, "collaboration_blocked");
    assert.equal((await messageStore.findByMessageId(blockedId))?.messageId, blockedId);

    await updateCurrentLink({ collaborationStatus: "active" });
    transportResult = () => ({ kind: "timeout" });
    const disconnected = await postChat(RECIPIENT_MEMBER, { body: "Before disconnect" }, adminToken());
    const disconnectedId = disconnected.body.data?.messageId ?? "";
    assert.equal(requests.length, 2);
    await updateCurrentLink({ state: "disabled", disconnectedAt: new Date().toISOString() });
    transportResult = (request) => accepted(request, false);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 2);
    assert.equal((await messageStore.findByMessageId(disconnectedId))?.status, "failed");
    assert.equal((await messageStore.findByMessageId(disconnectedId))?.lastErrorCode, "link_disabled");

    await updateCurrentLink({
      state: "linked",
      disconnectedAt: null,
      collaborationStatus: "active",
      authorActivationPending: false,
    });
    transportResult = () => ({ kind: "timeout" });
    const pending = await postChat(RECIPIENT_MEMBER, { body: "Before activation stalls" }, adminToken());
    const pendingId = pending.body.data?.messageId ?? "";
    assert.equal(requests.length, 3);
    await updateCurrentLink({ authorActivationPending: true });
    transportResult = (request) => accepted(request, false);
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, 3);
    assert.equal((await messageStore.findByMessageId(pendingId))?.status, "failed");
    assert.equal((await messageStore.findByMessageId(pendingId))?.lastErrorCode, "author_activation_pending");
  });

  it("rejects chat while the collaboration is blocked, archived, disconnected, or awaiting activation", async () => {
    await seedLink({ collaborationStatus: "blocked" });
    const blocked = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.meta.code, "collaboration_blocked");
    await replaceLink({ collaborationStatus: "archived" });
    const archived = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    assert.equal(archived.status, 409);
    assert.equal(archived.body.meta.code, "collaboration_archived");
    await replaceLink({ state: "disabled", disconnectedAt: new Date().toISOString() });
    const disabled = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    assert.equal(disabled.status, 409);
    assert.equal(disabled.body.meta.code, "link_disabled");
    await replaceLink({ state: "linked", disconnectedAt: null, authorActivationPending: true });
    const pending = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    assert.equal(pending.status, 409);
    assert.equal(pending.body.meta.code, "author_activation_pending");
    assert.equal(requests.length, 0);
    assert.equal((await messageStore.list()).length, 0);
  });

  it("shows chat in the existing history page and keeps the scheduler off inbound rows", async () => {
    await seedLink();
    transportResult = (request) => accepted(request, false);
    const created = await postChat(RECIPIENT_MEMBER, { body: "Hello author" }, adminToken());
    const chatId = created.body.data?.messageId ?? "";
    await seedMessage({
      messageId: historyId(91),
      recipientMemberId: RECIPIENT_MEMBER,
      recipientExternalAuthorId: AUTHOR,
      title: "Inbound",
      createdAt: historyTime(1),
      direction: "im_to_hu",
      kind: "chat",
      status: "pending",
      nextAttemptAt: null,
    });
    transportResult = () => ({ kind: "timeout" });
    const before = requests.length;
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, before);
    assert.equal((await messageStore.findByMessageId(historyId(91)))?.attemptCount, 1);
    const history = await getHistory(RECIPIENT_MEMBER, adminToken());
    const chat = history.body.data?.messages?.find((message) => message.messageId === chatId);
    assert.equal(chat?.direction, "hu_to_im");
    assert.equal(chat?.kind, "chat");
    assert.equal(chat?.body, "Hello author");
    assert.equal(chat?.title, "");
    assert.equal(chat?.delivery?.status, "delivered");
    const inbound = history.body.data?.messages?.find((message) => message.messageId === historyId(91));
    assert.equal(inbound?.direction, "im_to_hu");
    assert.equal(inbound?.delivery ?? null, null);
  });

  async function assertPermanentRemoteFailure(status: number, code: string): Promise<void> {
    await seedLink();
    transportResult = () => ({
      kind: "response",
      status,
      body: JSON.stringify({ success: false, error: code }),
    });
    const response = await post(RECIPIENT_MEMBER, validBody(), adminToken());
    assert.equal(response.status, 200);
    assert.equal(response.body.data?.status, "failed");
    assert.equal(response.body.data?.lastErrorCode, code);
    const calls = requests.length;
    await reconcilePendingIntegrityMediaAuthorMessages({ now: later() });
    assert.equal(requests.length, calls);
    assert.equal((await messageStore.list())[0]?.status, "failed");
  }
});

function validBody(): { title: string; body: string } {
  return { title: TITLE, body: BODY_MARKER };
}

function historyId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function historyTime(index: number): string {
  return new Date(Date.UTC(2026, 3, 1, 0, 0, index)).toISOString();
}

async function getHistory(
  memberId: string,
  token: string | null,
  query: Record<string, string> = {},
): Promise<{
  status: number;
  body: {
    success: boolean;
    data: {
      memberId?: string;
      messages?: Array<{
        messageId: string;
        direction?: string;
        kind?: string;
        title?: string | null;
        body?: string;
        createdAt?: string;
        actorMemberId?: string | null;
        cta?: { label: string; url: string } | null;
        delivery?: { status?: string; deliveredAt?: string | null } | null;
      }>;
      pageInfo?: { hasMore?: boolean; nextCursor?: string | null };
    } | null;
    meta: { code?: string };
  };
}> {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors/${memberId}/messages${suffix ? `?${suffix}` : ""}`,
    { headers },
  );
  return {
    status: response.status,
    body: (await response.json()) as {
      success: boolean;
      data: {
        memberId?: string;
        messages?: Array<{
          messageId: string;
          direction?: string;
          kind?: string;
          title?: string | null;
          body?: string;
          createdAt?: string;
          actorMemberId?: string | null;
          cta?: { label: string; url: string } | null;
          delivery?: { status?: string; deliveredAt?: string | null } | null;
        }>;
        pageInfo?: { hasMore?: boolean; nextCursor?: string | null };
      } | null;
      meta: { code?: string };
    },
  };
}

function adminToken(): string {
  return tokenFor("admin-user", ADMIN_MEMBER, "admin");
}

function tokenFor(userId: string, memberId: string, role: string): string {
  return createAccessToken({
    sub: userId,
    memberId,
    role: role as "admin",
    displayName: "Test User",
    email: `${userId}@example.com`,
  });
}

function rememberUser(userId: string, memberId: string, role: string): void {
  const now = new Date().toISOString();
  users.set(userId, {
    userId,
    email: `${userId}@example.com`,
    passwordHash: "not-a-credential",
    displayName: "Test User",
    role: role as AuthUserRecord["role"],
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  });
}

interface DirectoryAuthorRow {
  memberId?: string;
  state?: string;
  authorActivationPending?: boolean;
  collaborationStatus?: string;
  canSend?: boolean;
  participantDisplayName?: string;
  participantAvatarUrl?: string;
  messageCount?: number;
  latestMessage?: { title?: string; status?: string } | null;
}

interface DirectoryBody {
  success: boolean;
  data: {
    authors?: DirectoryAuthorRow[];
    total?: number;
    hasMore?: boolean;
  } | null;
  meta: { code?: string };
  message: string;
}

async function seedDirectory(): Promise<void> {
  await seedLink({
    externalAuthorId: AUTHOR,
    memberId: RECIPIENT_MEMBER,
    state: "linked",
    createdAt: "2026-03-03T00:00:00.000Z",
    confirmedAt: "2026-03-03T00:00:00.000Z",
  });
  await seedLink({
    externalAuthorId: PENDING_AUTHOR,
    memberId: PENDING_MEMBER,
    state: "linked",
    authorActivationPending: true,
    createdAt: "2026-03-02T00:00:00.000Z",
    confirmedAt: "2026-03-02T00:00:00.000Z",
  });
  await seedLink({
    externalAuthorId: DISABLED_AUTHOR,
    memberId: DISABLED_MEMBER,
    state: "disabled",
    disconnectedAt: "2026-03-04T00:00:00.000Z",
    createdAt: "2026-03-01T00:00:00.000Z",
    confirmedAt: "2026-03-01T00:00:00.000Z",
  });
  await seedMessage({
    messageId: "11111111-1111-4111-8111-111111111111",
    recipientMemberId: RECIPIENT_MEMBER,
    recipientExternalAuthorId: AUTHOR,
    title: "Older note",
    status: "failed",
    lastErrorCode: "link_ineligible",
    createdAt: "2026-03-03T01:00:00.000Z",
  });
  await seedMessage({
    messageId: "22222222-2222-4222-8222-222222222222",
    recipientMemberId: RECIPIENT_MEMBER,
    recipientExternalAuthorId: AUTHOR,
    title: "Newer note",
    status: "delivered",
    deliveredAt: "2026-03-03T02:00:00.000Z",
    createdAt: "2026-03-03T02:00:00.000Z",
  });
}

async function seedMessage(
  overrides: Partial<IntegrityMediaAuthorMessageRecord> &
    Pick<
      IntegrityMediaAuthorMessageRecord,
      "messageId" | "recipientMemberId" | "recipientExternalAuthorId" | "title" | "createdAt"
    >,
): Promise<void> {
  const inserted = await messageStore.insert({
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    category: "notification",
    body: BODY_MARKER,
    cta: { label: "Open", url: "https://example.com/cta" },
    status: "pending",
    attemptCount: 1,
    lastAttemptAt: overrides.createdAt,
    nextAttemptAt: null,
    deliveredAt: null,
    lastErrorCode: null,
    updatedAt: overrides.createdAt,
    ...overrides,
  });
  assert.equal(inserted, "inserted");
}

async function listAuthors(
  token: string | null,
  query: Record<string, string> = {},
): Promise<{ status: number; body: DirectoryBody }> {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors${suffix ? `?${suffix}` : ""}`,
    { headers },
  );
  return { status: response.status, body: (await response.json()) as DirectoryBody };
}

function directoryAuthors(body: DirectoryBody): DirectoryAuthorRow[] {
  return body.data?.authors ?? [];
}

async function seedLink(
  overrides: Partial<ExternalAuthorLinkRecord> = {},
): Promise<void> {
  const now = new Date().toISOString();
  await linkStore.insertLink({
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: AUTHOR,
    memberId: RECIPIENT_MEMBER,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    ...overrides,
  });
}

function accepted(
  request: IntegrityMediaAuthorMessageHttpRequest,
  idempotent: boolean,
): IntegrityMediaAuthorMessageHttpResult {
  const remote = JSON.parse(request.body) as { messageId: string; recipientAuthorId: string };
  return {
    kind: "response",
    status: 200,
    body: JSON.stringify({
      success: true,
      data: {
        messageId: remote.messageId,
        recipientAuthorId: remote.recipientAuthorId,
        idempotent,
      },
    }),
  };
}

function later(): Date {
  return new Date(Date.now() + INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS + 5_000);
}

async function updateCurrentLink(patch: Partial<ExternalAuthorLinkRecord>): Promise<void> {
  const current = (await linkStore.listLinks()).find((link) => link.memberId === RECIPIENT_MEMBER);
  assert.ok(current);
  const updated = await linkStore.updateLink({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  assert.equal(updated, "updated");
}

async function replaceLink(patch: Partial<ExternalAuthorLinkRecord>): Promise<void> {
  await updateCurrentLink(patch);
}

function chatSignature(input: {
  timestamp: string;
  messageId: string;
  recipientAuthorId: string;
  body: string;
  title: string;
}): string {
  const hash = hashIntegrityMediaAuthorMessageContent({
    body: input.body,
    category: "notification",
    ctaLabel: "",
    ctaUrl: "",
    title: input.title,
  });
  const canonical = buildIntegrityMediaAuthorMessageCanonicalStringV2({
    timestamp: input.timestamp,
    messageId: input.messageId,
    recipientAuthorId: input.recipientAuthorId,
    kind: "chat",
    contentSha256: hash,
  });
  return signIntegrityMediaAuthorMessage(SECRET, canonical);
}

async function postChat(
  memberId: string,
  body: Record<string, unknown>,
  token: string | null,
): Promise<{ status: number; body: ApiBody }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}/api/v1/admin/integrity-media/authors/${memberId}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody,
  };
}

function signed(timestamp: string, title: string): { signature: string; hash: string; canonical: string } {
  const hash = hashIntegrityMediaAuthorMessageContent({
    body: BODY_MARKER,
    category: "notification",
    ctaLabel: "",
    ctaUrl: "",
    title,
  });
  const canonical = buildIntegrityMediaAuthorMessageCanonicalString({
    timestamp,
    messageId: "11111111-1111-4111-8111-111111111111",
    recipientAuthorId: AUTHOR,
    contentSha256: hash,
  });
  return {
    hash,
    canonical,
    signature: signIntegrityMediaAuthorMessage(SECRET, canonical),
  };
}

function independentSignature(input: {
  timestamp: string;
  messageId: string;
  recipientAuthorId: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const payload = JSON.stringify({
    body: input.body,
    category: "notification",
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    title: input.title,
  });
  const hash = createHash("sha256").update(payload, "utf8").digest("hex");
  const canonical = [
    "humanity-union-author-message",
    input.timestamp,
    input.messageId,
    input.recipientAuthorId,
    hash,
  ].join("\n");
  return createHmac("sha256", SECRET).update(canonical).digest("hex");
}

async function post(
  memberId: string,
  body: Record<string, unknown>,
  token: string | null,
): Promise<{ status: number; body: ApiBody }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}/api/v1/admin/integrity-media/authors/${memberId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody,
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
