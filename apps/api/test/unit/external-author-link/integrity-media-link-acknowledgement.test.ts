import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import { resolveIntegrityMediaLinkConfig } from "../../../src/modules/external-author-link/external-author-link.config.js";
import {
  INTEGRITY_MEDIA_LINK_ACKNOWLEDGE_PURPOSE,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  resetIntegrityMediaAcknowledgeReplayCacheForTests,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import { EXTERNAL_AUTHOR_LINK_INDEXES } from "../../../src/modules/external-author-link/external-author-link.indexes.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  isIntegrityMediaAuthorLinkOperational,
  setIntegrityMediaAuthorCapabilityEnsurerForTests,
} from "../../../src/modules/external-author-link/external-author-link.service.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "../../../src/modules/external-author-link/external-author-link.collaboration.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";

const SECRET = "acknowledgement-test-secret";
const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INSTANCE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const INSTANCE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let store: ExternalAuthorLinkStore;
let grantCalls = 0;

describe("Integrity Media link acknowledgement", () => {
  before(async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    store = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(store);
    resetIntegrityMediaAcknowledgeReplayCacheForTests();
    grantCalls = 0;
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => {
      grantCalls += 1;
      return {
        changed: false,
        capabilities: ["author"],
        publishWithoutManualReview: false,
      };
    });
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    assert.equal(resolveIntegrityMediaLinkConfig().hmacSecret, SECRET);
    assert.equal(INTEGRITY_MEDIA_LINK_ACKNOWLEDGE_PURPOSE, "integrity-media-link-acknowledge");
  });

  it("confirms an exact provisional instance and leaves a repeat unchanged", async () => {
    await store.insertLink(protocolLink(AUTHOR_A, MEMBER_A, INSTANCE_A));
    const first = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A);
    const afterFirst = await linkFor(AUTHOR_A);
    const second = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A);
    const afterSecond = await linkFor(AUTHOR_A);

    assert.equal(first.status, 200);
    assert.equal(first.body.data?.idempotent, false);
    assert.equal(first.body.data?.finalization, "confirmed");
    assert.equal(afterFirst?.linkFinalization, "confirmed");
    assert.equal(afterFirst?.linkInstanceId, INSTANCE_A);
    assert.equal(second.status, 200);
    assert.equal(second.body.data?.idempotent, true);
    assert.deepEqual(afterSecond, afterFirst);
    assert.equal(isIntegrityMediaAuthorLinkOperational(afterSecond!), true);
  });

  it("refuses a different member, revision, or instance without confirming", async () => {
    await store.insertLink(protocolLink(AUTHOR_A, MEMBER_A, INSTANCE_A));
    const before = await linkFor(AUTHOR_A);

    const wrongMember = await acknowledge(AUTHOR_A, MEMBER_B, 1, INSTANCE_A);
    const wrongRevision = await acknowledge(AUTHOR_A, MEMBER_A, 2, INSTANCE_A);
    const wrongInstance = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_B);

    assert.equal(wrongMember.status, 409);
    assert.equal(wrongMember.body.meta.code, "acknowledgement_mismatch");
    assert.equal(wrongRevision.status, 409);
    assert.equal(wrongRevision.body.meta.code, "acknowledgement_mismatch");
    assert.equal(wrongInstance.status, 409);
    assert.equal(wrongInstance.body.meta.code, "acknowledgement_mismatch");
    assert.deepEqual(await linkFor(AUTHOR_A), before);
    assert.equal(isOrdinaryIntegrityMediaCollaborationAllowed(before!), false);
    assert.equal(grantCalls, 0);
  });

  it("refuses acknowledgement of a disabled provisional or confirmed link", async () => {
    await store.insertLink(protocolLink(AUTHOR_A, MEMBER_A, INSTANCE_A));
    await disableStored(AUTHOR_A);
    const disabledProvisional = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A);
    const provisionalAfter = await linkFor(AUTHOR_A);

    assert.equal(disabledProvisional.status, 409);
    assert.equal(disabledProvisional.body.meta.code, "link_disabled");
    assert.equal(provisionalAfter?.state, "disabled");
    assert.equal(provisionalAfter?.linkFinalization, "provisional");
    assert.equal(grantCalls, 0);

    await store.insertLink(protocolLink(AUTHOR_B, MEMBER_B, INSTANCE_B));
    const confirmed = await acknowledge(AUTHOR_B, MEMBER_B, 1, INSTANCE_B);
    assert.equal(confirmed.status, 200);
    assert.equal(grantCalls, 1);
    await disableStored(AUTHOR_B);
    const disabledConfirmed = await acknowledge(AUTHOR_B, MEMBER_B, 1, INSTANCE_B);
    const confirmedAfter = await linkFor(AUTHOR_B);

    assert.equal(disabledConfirmed.status, 409);
    assert.equal(disabledConfirmed.body.meta.code, "link_disabled");
    assert.equal(confirmedAfter?.state, "disabled");
    assert.equal(confirmedAfter?.linkFinalization, "confirmed");
    assert.equal(grantCalls, 1);
  });

  it("does not migrate or confirm a legacy row", async () => {
    const legacy = legacyLink(AUTHOR_A, MEMBER_A);
    await store.insertLink(legacy);
    const response = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A);
    const stored = await linkFor(AUTHOR_A);

    assert.equal(response.status, 409);
    assert.equal(response.body.meta.code, "acknowledgement_unavailable");
    assert.equal(stored?.linkFinalization, undefined);
    assert.equal(stored?.linkInstanceId, undefined);
    assert.equal(isIntegrityMediaAuthorLinkOperational(stored!), true);
    assert.equal(isOrdinaryIntegrityMediaCollaborationAllowed(stored!), true);
  });

  it("keeps a concurrent acknowledgement to one confirmed instance", async () => {
    await store.insertLink(protocolLink(AUTHOR_A, MEMBER_A, INSTANCE_A));
    const [first, second] = await Promise.all([
      acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A),
      acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A),
    ]);
    const stored = await linkFor(AUTHOR_A);
    const outcomes = [first, second].map((response) => response.body.data?.idempotent);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(outcomes.filter((idempotent) => idempotent === false).length, 1);
    assert.equal(stored?.linkFinalization, "confirmed");
    assert.equal(stored?.linkInstanceId, INSTANCE_A);
    assert.equal((await store.listLinks()).length, 1);
  });

  it("does not change another author's link", async () => {
    await store.insertLink(protocolLink(AUTHOR_A, MEMBER_A, INSTANCE_A));
    await store.insertLink(protocolLink(AUTHOR_B, MEMBER_B, INSTANCE_B, 2));
    const otherBefore = await linkFor(AUTHOR_B);

    const confirmed = await acknowledge(AUTHOR_A, MEMBER_A, 1, INSTANCE_A);
    const crossed = await acknowledge(AUTHOR_B, MEMBER_B, 2, INSTANCE_A);

    assert.equal(confirmed.status, 200);
    assert.equal(crossed.status, 409);
    assert.equal(crossed.body.meta.code, "acknowledgement_mismatch");
    assert.deepEqual(await linkFor(AUTHOR_B), otherBefore);
    assert.equal((await linkFor(AUTHOR_A))?.linkFinalization, "confirmed");
    assert.deepEqual(
      EXTERNAL_AUTHOR_LINK_INDEXES.map((index) => index.name),
      ["external_author_links_source_author_unique", "external_author_links_source_member_unique"],
    );
  });
});

function protocolLink(
  externalAuthorId: string,
  memberId: string,
  linkInstanceId: string,
  linkRevision = 1,
): ExternalAuthorLinkRecord {
  const now = "2026-04-01T00:00:00.000Z";
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId,
    memberId,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision,
    linkInstanceId,
    linkFinalization: "provisional",
  };
}

function legacyLink(externalAuthorId: string, memberId: string): ExternalAuthorLinkRecord {
  const now = "2026-03-01T00:00:00.000Z";
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId,
    memberId,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision: 1,
  };
}

async function linkFor(authorId: string): Promise<ExternalAuthorLinkRecord | undefined> {
  return (await store.listLinks()).find((link) => link.externalAuthorId === authorId);
}

async function disableStored(authorId: string): Promise<void> {
  const link = await linkFor(authorId);
  assert.ok(link);
  assert.equal(
    await store.updateLink({
      ...link,
      state: "disabled",
      disconnectedAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    }),
    "updated",
  );
}

async function acknowledge(
  externalAuthorId: string,
  memberId: string,
  linkRevision: number,
  linkInstanceId: string,
): Promise<{ status: number; body: ApiBody }> {
  const eventId = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkAcknowledgePayload({
      timestamp,
      eventId,
      externalAuthorId,
      memberId,
      linkRevision,
      linkInstanceId,
    }),
  );
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link/acknowledge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
    body: JSON.stringify({
      eventId,
      externalAuthorId,
      memberId,
      linkRevision,
      linkInstanceId,
    }),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
}
