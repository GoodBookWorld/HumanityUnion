import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import type { BlogCapabilityGrant } from "@hu/types";

import { setAuthUserLookupOverrideForTests } from "../../../src/modules/auth/auth-active-account-gate.js";
import { createAccessToken } from "../../../src/modules/auth/auth-tokens.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { ensureBlogAuthorCapability } from "../../../src/modules/blog/blog-author-capability.js";
import { resolveIntegrityMediaLinkConfig } from "../../../src/modules/external-author-link/external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { resetIntegrityMediaAuthorDisconnectReplayCacheForTests } from "../../../src/modules/external-author-link/external-author-link.disconnect-hmac.js";
import integrityMediaAuthorDisconnectRouter from "../../../src/modules/external-author-link/external-author-link.disconnect.routes.js";
import { EXTERNAL_AUTHOR_DISCONNECT_EVENT_INDEXES } from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  resetIntegrityMediaRedeemReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
  setIntegrityMediaDisplayNameResolverForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  deriveIntegrityMediaAuthorParticipantDisplay,
  setIntegrityMediaAuthorParticipantResolverForTests,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-directory.service.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import { buildIntegrityMediaLinkRedeemPayload } from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import integrityMediaAuthorMessageRouter from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.routes.js";
import {
  createMemoryIntegrityMediaAuthorMessageStore,
  setIntegrityMediaAuthorMessageStoreForTests,
  type IntegrityMediaAuthorMessageStore,
} from "../../../src/modules/integrity-media-author-messages/integrity-media-author-message.store.js";
import type { IntegrityMediaCollaborationStatus } from "../../../src/modules/external-author-link/external-author-link.types.js";

const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const ADMIN_MEMBER = "33333333-3333-4333-8333-333333333333";
const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SECRET = "hu-disconnect-test-secret";

interface ApiBody {
  success: boolean;
  data: {
    eventId?: string;
    authorId?: string;
    state?: string;
    idempotent?: boolean;
    reconnected?: boolean;
    redirectUrl?: string;
    authors?: Array<{
      memberId?: string;
      state?: string;
      canSend?: boolean;
      collaborationStatus?: string;
    }>;
  } | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let messageStore: IntegrityMediaAuthorMessageStore;
let grants = new Map<string, BlogCapabilityGrant>();
let ensureCalls = 0;
const users = new Map<string, AuthUserRecord>();

describe("Integrity Media author disconnect", () => {
  before(async () => {
    setAuthUserLookupOverrideForTests(async (userId) => users.get(userId) ?? null);
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    app.use("/api/v1/integrations/integrity-media", integrityMediaAuthorDisconnectRouter);
    app.use("/api/v1/admin/integrity-media/authors", integrityMediaAuthorMessageRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind the disconnect test server.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setAuthUserLookupOverrideForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorMessageStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setIntegrityMediaDisplayNameResolverForTests(null);
    setIntegrityMediaAuthorParticipantResolverForTests(null);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    store = createMemoryExternalAuthorLinkStore();
    messageStore = createMemoryIntegrityMediaAuthorMessageStore();
    setExternalAuthorLinkStoreForTests(store);
    setIntegrityMediaAuthorMessageStoreForTests(messageStore);
    resetIntegrityMediaRedeemReplayCacheForTests();
    resetIntegrityMediaAuthorDisconnectReplayCacheForTests();
    grants = new Map();
    ensureCalls = 0;
    users.clear();
    rememberUser(`user-${MEMBER_A}`, MEMBER_A, "member");
    rememberUser(`user-${MEMBER_B}`, MEMBER_B, "member");
    rememberUser(`user-${ADMIN_MEMBER}`, ADMIN_MEMBER, "admin");
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async (participantId) => {
      ensureCalls += 1;
      return ensureBlogAuthorCapability(participantId, {
        findGrant: async (id) => grants.get(id) ?? null,
        saveGrant: async (grant) => {
          grants.set(grant.participantId, { ...grant, capabilities: [...grant.capabilities] });
          return grant;
        },
      });
    });
    setIntegrityMediaDisplayNameResolverForTests(async () => "Test User");
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
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.example";
  });

  it("keeps disconnect event idempotency durable and separate from the link indexes", () => {
    assert.equal(
      EXTERNAL_AUTHOR_DISCONNECT_EVENT_INDEXES.some(
        (index) => index.unique === true && index.key.eventId === 1,
      ),
      true,
    );
    assert.equal(INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE, "integrity-media-author-disconnect");
    assert.equal(resolveIntegrityMediaLinkConfig().hmacSecret, SECRET);
  });

  it("disables a linked active pair and preserves collaboration, mapping, blog capability, and role", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    const roleBefore = users.get(`user-${MEMBER_A}`)?.role;
    const grantsBefore = ensureCalls;
    await messageStore.insert(sampleMessage(MEMBER_A, AUTHOR_A));
    const response = await disconnect(AUTHOR_A);

    assert.equal(response.status, 200);
    assert.equal(response.body.data?.state, "disabled");
    assert.equal(response.body.data?.idempotent, false);
    assert.equal(response.body.data?.authorId, AUTHOR_A);
    assert.equal(JSON.stringify(response.body).includes(SECRET), false);
    assert.equal(JSON.stringify(response.body).includes("memberId"), false);

    const link = (await store.listLinks())[0];
    assert.equal(link?.state, "disabled");
    assert.equal(link?.collaborationStatus, "active");
    assert.equal(link?.memberId, MEMBER_A);
    assert.equal(link?.externalAuthorId, AUTHOR_A);
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await messageStore.list()).length, 1);
    assert.equal(ensureCalls, grantsBefore);
    assert.deepEqual(grants.get(MEMBER_A)?.capabilities, ["author"]);
    assert.equal(users.get(`user-${MEMBER_A}`)?.role, roleBefore);
    assert.equal(
      (await store.listAudits()).filter((event) => event.action === "integrity_media_disconnect_accepted")
        .length,
      1,
    );

    const again = await disconnect(AUTHOR_A);
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.idempotent, false);
    assert.equal(again.body.data?.state, "disabled");
    assert.equal((await store.listLinks()).length, 1);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "active");
    assert.equal((await store.listDisconnectEvents()).length, 2);

    const listed = await listAuthors("disabled");
    assert.equal(listed[0]?.memberId, MEMBER_A);
    assert.equal(listed[0]?.state, "disabled");
    assert.equal(listed[0]?.canSend, false);
    assert.equal(listed[0]?.collaborationStatus, "active");
    assert.equal((await listAuthors("linked")).length, 0);
  });

  it("preserves blocked and archived collaboration status when the identity link is disabled", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    await setCollaboration(AUTHOR_A, "blocked");
    const blocked = await disconnect(AUTHOR_A);
    assert.equal(blocked.status, 200);
    assert.equal((await store.listLinks())[0]?.state, "disabled");
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "blocked");
    assert.equal((await listAuthors("disabled"))[0]?.canSend, false);
    assert.equal((await listAuthors("disabled"))[0]?.collaborationStatus, "blocked");

    await redeemLink(MEMBER_B, AUTHOR_B);
    await setCollaboration(AUTHOR_B, "archived");
    const archived = await disconnect(AUTHOR_B);
    assert.equal(archived.status, 200);
    const second = (await store.listLinks()).find((link) => link.externalAuthorId === AUTHOR_B);
    assert.equal(second?.state, "disabled");
    assert.equal(second?.collaborationStatus, "archived");
    assert.equal(second?.memberId, MEMBER_B);
  });

  it("rejects a missing link, a bad signature, a stale timestamp, and a replayed signature", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    const missing = await disconnect(AUTHOR_B);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.meta.code, "link_not_found");
    assert.equal((await store.listDisconnectEvents()).length, 0);
    assert.equal((await store.listLinks())[0]?.state, "linked");

    const badSignature = await disconnect(AUTHOR_A, { signature: "a".repeat(64) });
    assert.equal(badSignature.status, 401);
    assert.equal(badSignature.body.meta.code, "invalid_signature");
    assert.equal((await store.listLinks())[0]?.state, "linked");

    const stale = await disconnect(AUTHOR_A, { timestamp: "1000000000" });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_timestamp");
    assert.equal((await store.listLinks())[0]?.state, "linked");

    const eventId = randomUUID();
    const first = await disconnect(AUTHOR_A, { eventId });
    assert.equal(first.status, 200);
    const replay = await disconnect(AUTHOR_A, {
      eventId,
      timestamp: first.timestamp,
      signature: first.signature,
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");
    assert.equal((await store.listDisconnectEvents()).length, 1);
  });

  it("treats the same event id and author as idempotent after the replay cache is cleared", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    const eventId = randomUUID();
    const first = await disconnect(AUTHOR_A, { eventId });
    assert.equal(first.body.data?.idempotent, false);
    resetIntegrityMediaAuthorDisconnectReplayCacheForTests();
    const again = await disconnect(AUTHOR_A, { eventId });
    assert.equal(again.status, 200);
    assert.equal(again.body.data?.idempotent, true);
    assert.equal(again.body.data?.state, "disabled");
    assert.equal((await store.listDisconnectEvents()).length, 1);
    assert.equal(
      (await store.listAudits()).filter((event) => event.action === "integrity_media_disconnect_accepted")
        .length,
      1,
    );
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
    assert.equal((await store.listLinks())[0]?.collaborationStatus, "active");
  });

  it("conflicts when the same event id is reused for a different author", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    await redeemLink(MEMBER_B, AUTHOR_B);
    const eventId = randomUUID();
    const first = await disconnect(AUTHOR_A, { eventId });
    assert.equal(first.status, 200);
    resetIntegrityMediaAuthorDisconnectReplayCacheForTests();
    const conflict = await disconnect(AUTHOR_B, { eventId });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.meta.code, "event_conflict");
    const second = (await store.listLinks()).find((link) => link.externalAuthorId === AUTHOR_B);
    assert.equal(second?.state, "linked");
    assert.equal(second?.memberId, MEMBER_B);
    assert.equal((await store.listDisconnectEvents()).length, 1);
  });

  it("rejects a caller-supplied member id and does not treat it as authority", async () => {
    await redeemLink(MEMBER_A, AUTHOR_A);
    const response = await fetch(`${baseUrl}/api/v1/integrations/integrity-media/author-disconnect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: randomUUID(), authorId: AUTHOR_A, memberId: MEMBER_B }),
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as ApiBody;
    assert.equal(body.meta.code, "invalid_request");
    assert.equal((await store.listLinks())[0]?.state, "linked");
    assert.equal((await store.listLinks())[0]?.memberId, MEMBER_A);
  });

  it("reconnects the same pair and preserves active, blocked, and archived collaboration", async () => {
    await assertReconnectPreserves(MEMBER_A, AUTHOR_A, "active");
    await assertReconnectPreserves(MEMBER_B, AUTHOR_B, "blocked");
  });

  it("reconnects an archived collaboration without minting a new pair", async () => {
    const member = "44444444-4444-4444-8444-444444444444";
    const author = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    rememberUser(`user-${member}`, member, "member");
    await assertReconnectPreserves(member, author, "archived");
    assert.equal((await store.listLinks()).filter((link) => link.externalAuthorId === author).length, 1);
    assert.equal(INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(author), true);
  });
});

async function assertReconnectPreserves(
  memberId: string,
  authorId: string,
  collaborationStatus: IntegrityMediaCollaborationStatus,
): Promise<void> {
  await redeemLink(memberId, authorId);
  if (collaborationStatus !== "active") {
    await setCollaboration(authorId, collaborationStatus);
  }
  const disabled = await disconnect(authorId);
  assert.equal(disabled.status, 200);
  assert.equal(
    (await store.listLinks()).find((link) => link.externalAuthorId === authorId)?.state,
    "disabled",
  );

  const restored = await redeemLink(memberId, authorId);
  assert.equal(restored.body.data?.reconnected, true);
  const link = (await store.listLinks()).find((item) => item.externalAuthorId === authorId);
  assert.equal(link?.state, "linked");
  assert.equal(link?.collaborationStatus, collaborationStatus);
  assert.equal(link?.memberId, memberId);
  assert.equal((await store.listLinks()).filter((item) => item.memberId === memberId).length, 1);
}

async function redeemLink(
  memberId: string,
  authorId: string,
): Promise<{ status: number; body: ApiBody }> {
  const state = `state-${randomUUID().replace(/-/g, "")}`;
  const confirmed = await fetch(`${baseUrl}/api/v1/integrity-media/link/confirm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${tokenFor(memberId, "member")}`,
    },
    body: JSON.stringify({ state }),
  });
  const confirmedBody = (await confirmed.json()) as ApiBody;
  assert.equal(confirmed.status, 200);
  const code = new URL(String(confirmedBody.data?.redirectUrl)).searchParams.get("code") ?? "";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: authorId,
    }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/redeem`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify({ resultCode: code, externalAuthorId: authorId }),
  });
  const body = (await response.json()) as ApiBody;
  assert.equal(response.status, 200);
  return { status: response.status, body };
}

async function disconnect(
  authorId: string,
  override: { eventId?: string; timestamp?: string; signature?: string } = {},
): Promise<{ status: number; body: ApiBody; timestamp: string; signature: string }> {
  const eventId = override.eventId ?? randomUUID();
  const timestamp = override.timestamp ?? String(Math.floor(Date.now() / 1000));
  const canonical = [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE, timestamp, eventId, authorId].join("\n");
  const signature =
    override.signature ?? createHmac("sha256", SECRET).update(canonical).digest("hex");
  const response = await fetch(`${baseUrl}/api/v1/integrations/integrity-media/author-disconnect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER]: timestamp,
      [INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER]: signature,
    },
    body: JSON.stringify({ eventId, authorId }),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody,
    timestamp,
    signature,
  };
}

async function listAuthors(state: string): Promise<NonNullable<ApiBody["data"]>["authors"]> {
  const response = await fetch(
    `${baseUrl}/api/v1/admin/integrity-media/authors?state=${state}`,
    { headers: { authorization: `Bearer ${tokenFor(ADMIN_MEMBER, "admin")}` } },
  );
  const body = (await response.json()) as ApiBody;
  assert.equal(response.status, 200);
  return body.data?.authors ?? [];
}

async function setCollaboration(
  authorId: string,
  collaborationStatus: IntegrityMediaCollaborationStatus,
): Promise<void> {
  const link = (await store.listLinks()).find((item) => item.externalAuthorId === authorId);
  assert.ok(link);
  assert.equal(await store.updateLink({ ...link, collaborationStatus }), "updated");
}

function tokenFor(memberId: string, role: "member" | "admin"): string {
  return createAccessToken({
    sub: `user-${memberId}`,
    memberId,
    role,
    displayName: "Test User",
    email: `${memberId}@example.com`,
  });
}

function rememberUser(userId: string, memberId: string, role: "member" | "admin"): void {
  const now = new Date().toISOString();
  users.set(userId, {
    userId,
    email: `${userId}@example.com`,
    passwordHash: "not-a-credential",
    displayName: "Test User",
    role,
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  });
}

function sampleMessage(memberId: string, authorId: string) {
  const now = new Date().toISOString();
  return {
    messageId: randomUUID(),
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: ADMIN_MEMBER,
    recipientMemberId: memberId,
    recipientExternalAuthorId: authorId,
    category: "notification" as const,
    title: "Kept",
    body: "Evidence stays.",
    cta: null,
    status: "delivered" as const,
    attemptCount: 1,
    lastAttemptAt: now,
    nextAttemptAt: null,
    deliveredAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}
