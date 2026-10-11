import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, before, after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";

import express from "express";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { isIntegrityMediaAuthorLinkOperational } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.indexes.js";
import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_TIMEOUT_MS,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.constants.js";
import {
  buildIntegrityMediaAuthorMessageCanonicalString,
  buildIntegrityMediaAuthorMessageContentPayload,
  hashIntegrityMediaAuthorMessageContent,
  signIntegrityMediaAuthorMessage,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.hmac.js";
import { reconcilePendingIntegrityMediaAuthorMessages } from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.reconciliation.js";
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

  it("starts the message scheduler without starting a second timer", () => {
    startIntegrityMediaAuthorMessageScheduler();
    startIntegrityMediaAuthorMessageScheduler();
    stopIntegrityMediaAuthorMessageScheduler();
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
