import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE,
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { signIntegrityMediaLinkRedeem } from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import {
  buildProvisionAttemptPayload,
  resetProvisionAttemptReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import {
  buildProvisionSnapshotPayload,
  resetProvisionSnapshotReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-snapshot.hmac.js";
import {
  buildProvisionVersionPayload,
  resetProvisionVersionReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-version.hmac.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import { setIntegrityMediaAuthorCapabilityEnsurerForTests } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
  type MemoryProvisionState,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";
import { buildNewPersistedMember } from "../../../src/modules/member/infrastructure/member.persistence.js";
import { buildDefaultMemberProfile } from "../../../src/modules/member-profile/member-profile.repository.js";

const SECRET = "dummy-secret-not-real";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
const RETURN_PATH = "/api/author/humanity-union-link/complete";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let memory: MemoryProvisionState;
let previousMode: string | undefined;
let previousSecret: string | undefined;
let previousOrigin: string | undefined;

describe("Integrity Media provision version declaration", () => {
  before(async () => {
    previousMode = process.env.PLATFORM_MODE;
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousOrigin = process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV];
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";

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
    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
    restoreEnv(INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV, previousOrigin);
    restoreEnv("PLATFORM_MODE", previousMode);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.PLATFORM_MODE = "staging";
    resetProvisionAttemptReplayCacheForTests();
    resetProvisionSnapshotReplayCacheForTests();
    resetProvisionVersionReplayCacheForTests();
    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    setExternalAuthorLinkStoreForTests(createMemoryExternalAuthorLinkStore());
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => ({
      changed: false,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    }));
  });

  it("keeps a legacy ten-field registration and Confirm free of a snapshot", async () => {
    const payload = buildProvisionAttemptPayload({
      timestamp: "1700000000",
      attemptId: "exampleAttemptToken_12",
      externalAuthorId: AUTHOR,
      email: "author@example.com",
      displayName: "Example Author",
      target: "staging",
      expiresAt: "1700000600",
      returnPath: RETURN_PATH,
      emailVerification: "pending",
    });
    assert.equal(payload.split("\n").length, 10);
    assert.equal(payload.endsWith("\n"), false);
    assert.equal(payload.includes(INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE), false);

    const created = await register(attemptBody(), { version2: false });
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.idempotent, false);
    assert.equal(memory.attempts()[0]?.snapshotRequired, undefined);
    assert.equal(JSON.stringify(created.body).includes(created.signature), false);

    const confirmed = await confirm("exampleAttemptToken_12");
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users().length, 1);
    assert.equal(memory.profiles()[0]?.displayName, "Example Author");
    assert.equal(memory.profiles()[0]?.biography, undefined);
  });

  it("stores a version-2 declaration atomically with the original attempt", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = attemptBody();
    const canonical = buildProvisionVersionPayload({
      timestamp,
      attemptId: body.attemptId,
      target: body.target,
    });
    assert.deepEqual(canonical.split("\n"), [
      INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE,
      timestamp,
      body.attemptId,
      "staging",
      "2",
    ]);
    assert.equal(canonical.endsWith("\n"), false);

    const created = await register(body, { version2: true, timestamp });
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.idempotent, false);
    assert.equal(memory.attempts().length, 1);
    assert.equal(memory.attempts()[0]?.snapshotRequired, true);
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);
    assert.equal(memory.users().length, 0);
    assert.equal(JSON.stringify(created.body).includes(created.versionSignature), false);

    const same = await register(body, { version2: true, timestamp: String(Number(timestamp) + 1) });
    assert.equal(same.status, 200);
    assert.equal(same.body.data?.idempotent, true);
    assert.equal(memory.attempts().length, 1);
    assert.equal(memory.attempts()[0]?.snapshotRequired, true);
    assert.equal(memory.attempts()[0]?.expiresAt, body.expiresAt);
  });

  it("rejects a partial, invalid, mismatched, or stale version declaration", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = attemptBody();
    const partialTimestamp = await register(body, {
      version2: false,
      timestamp,
      extraHeaders: { "x-hu-integrity-media-version-timestamp": timestamp },
    });
    assert.equal(partialTimestamp.status, 400);
    assert.equal(partialTimestamp.body.meta.code, "incomplete_version");

    const partialSignature = await register(body, {
      version2: false,
      timestamp: String(Number(timestamp) + 1),
      extraHeaders: { "x-hu-integrity-media-version-signature": "ab".repeat(32) },
    });
    assert.equal(partialSignature.status, 400);
    assert.equal(partialSignature.body.meta.code, "incomplete_version");

    const invalid = await register(body, {
      version2: true,
      timestamp: String(Number(timestamp) + 2),
      versionSignature: "ab".repeat(32),
    });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta.code, "invalid_version_signature");

    const wrongAttempt = await register(body, {
      version2: true,
      timestamp: String(Number(timestamp) + 3),
      versionAttemptId: "otherAttemptToken_012",
    });
    assert.equal(wrongAttempt.status, 401);
    assert.equal(wrongAttempt.body.meta.code, "invalid_version_signature");

    const wrongTarget = await register(body, {
      version2: true,
      timestamp: String(Number(timestamp) + 4),
      versionTarget: "production",
    });
    assert.equal(wrongTarget.status, 401);
    assert.equal(wrongTarget.body.meta.code, "invalid_version_signature");

    const wrongVersion = await register(body, {
      version2: true,
      timestamp: String(Number(timestamp) + 5),
      versionLine: "3",
    });
    assert.equal(wrongVersion.status, 401);
    assert.equal(wrongVersion.body.meta.code, "invalid_version_signature");

    const stale = await register(body, {
      version2: true,
      timestamp: String(Number(timestamp) + 6),
      versionTimestamp: String(Number(timestamp) - 301),
    });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_version_timestamp");
    assert.equal(memory.attempts().length, 0);
    assert.equal(memory.users().length, 0);
  });

  it("rejects a repeated registration that changes the stored version", async () => {
    const versioned = await register(attemptBody(), { version2: true });
    assert.equal(versioned.status, 200);
    const downgrade = await register(attemptBody(), {
      version2: false,
      timestamp: String(Number(versioned.timestamp) + 1),
    });
    assert.equal(downgrade.status, 409);
    assert.equal(downgrade.body.meta.code, "version_conflict");
    assert.equal(memory.attempts()[0]?.snapshotRequired, true);

    const legacyId = "legacyAttemptToken_01";
    const legacy = await register(attemptBody({ attemptId: legacyId }), { version2: false });
    assert.equal(legacy.status, 200);
    const upgrade = await register(attemptBody({ attemptId: legacyId }), {
      version2: true,
      timestamp: String(Number(legacy.timestamp) + 1),
    });
    assert.equal(upgrade.status, 409);
    assert.equal(upgrade.body.meta.code, "version_conflict");
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === legacyId)?.snapshotRequired,
      undefined,
    );
    assert.equal(memory.users().length, 0);
  });

  it("blocks a new Participant until the required snapshot is accepted", async () => {
    const created = await register(attemptBody(), { version2: true });
    assert.equal(created.status, 200);
    const blocked = await confirm("exampleAttemptToken_12");
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.meta.code, "snapshot_required");
    assert.equal(memory.users().length, 0);
    assert.equal(memory.profiles().length, 0);
    assert.equal(memory.participants().length, 0);
    assert.equal(memory.links().length, 0);
    assert.equal(memory.grants().length, 0);
    assert.equal(memory.attempts()[0]?.memberId, null);
    assert.equal(memory.attempts()[0]?.createdMember, false);
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);

    const legacySnapshot = await register(attemptBody({ attemptId: "legacyAttemptToken_02" }), {
      version2: false,
    });
    assert.equal(legacySnapshot.status, 200);
    const rejected = await snapshot("legacyAttemptToken_02");
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.meta.code, "snapshot_not_required");

    const stored = await snapshot("exampleAttemptToken_12");
    assert.equal(stored.status, 200);
    const confirmed = await confirm("exampleAttemptToken_12");
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.profiles().find((profile) => profile.displayName === "Snapshot Public")?.biography, "Public biography.");
    const consumed = await snapshot("exampleAttemptToken_12", { displayName: "Changed Name" });
    assert.equal(consumed.status, 409);
    assert.equal(consumed.body.meta.code, "attempt_consumed");
  });

  it("lets whichever of snapshot registration or Confirm arrives second finish one new Participant", async () => {
    const attemptId = "concurrentVersionTok1";
    assert.equal((await register(attemptBody({ attemptId }), { version2: true })).status, 200);
    const [confirmed, stored] = await Promise.all([confirm(attemptId), snapshot(attemptId)]);
    const snapshotFirst = confirmed.status === 200 && stored.status === 200;
    const confirmFirst =
      confirmed.status === 409 &&
      confirmed.body.meta.code === "snapshot_required" &&
      stored.status === 200 &&
      memory.users().length === 0;
    assert.equal(snapshotFirst || confirmFirst, true);
    if (confirmFirst) {
      const retry = await confirm(attemptId);
      assert.equal(retry.status, 200);
      assert.equal(retry.body.data?.provisionOutcome, "NEW_AUTHOR");
    }
    assert.equal(memory.users().length, 1);
    assert.equal(memory.profiles()[0]?.displayName, "Snapshot Public");
    assert.equal(memory.attempts()[0]?.snapshotRequired, true);
  });

  it("does not import a snapshot onto an existing Participant or a production target", async () => {
    const memberId = "33333333-3333-4333-8333-333333333333";
    const userId = "user-existing-version";
    const authorId = "22222222-2222-4222-8222-222222222222";
    const profile = buildDefaultMemberProfile({ userId, displayName: "Existing Person" });
    profile.biography = "Original biography";
    await memory.view().insertUser(existingUser("existing@example.com", memberId, userId));
    await memory.view().insertProfile(profile);
    await memory.view().insertParticipant(
      buildNewPersistedMember({
        memberId,
        identityId: userId,
        displayName: "Existing Person",
        uniqueName: "existing-person",
        verificationLevel: "none",
      }),
    );
    await memory.view().insertLink(confirmedLink(authorId, memberId));
    assert.equal(
      (
        await register(
          attemptBody({
            attemptId: "existingAttemptToken1",
            externalAuthorId: authorId,
            email: "existing@example.com",
            displayName: "Existing Person",
          }),
          { version2: true },
        )
      ).status,
      200,
    );
    const reused = await confirm("existingAttemptToken1");
    assert.equal(reused.status, 200);
    assert.equal(reused.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.profiles().find((item) => item.userId === userId)?.displayName, "Existing Person");
    assert.equal(memory.profiles().find((item) => item.userId === userId)?.biography, "Original biography");
    assert.equal(memory.users().length, 1);
    const late = await snapshot("existingAttemptToken1");
    assert.equal(late.status, 409);
    assert.equal(late.body.meta.code, "attempt_consumed");
    assert.equal(memory.profiles().find((item) => item.userId === userId)?.biography, "Original biography");

    process.env.PLATFORM_MODE = "production";
    const production = await register(attemptBody({ attemptId: "productionAttemptTok1" }), {
      version2: true,
    });
    assert.equal(production.status, 403);
    assert.equal(production.body.meta.code, "target_mismatch");
    process.env.PLATFORM_MODE = "staging";
    const otherTarget = await register(
      attemptBody({ attemptId: "productionAttemptTok2", target: "production" }),
      { version2: true },
    );
    assert.equal(otherTarget.status, 403);
    assert.equal(otherTarget.body.meta.code, "target_mismatch");
    assert.equal(memory.attempts().some((attempt) => attempt.attemptId.startsWith("production")), false);

    const expired = await register(
      attemptBody({
        attemptId: "expiredVersionToken01",
        expiresAt: Math.floor(Date.now() / 1000) - 60,
      }),
      { version2: true },
    );
    assert.equal(expired.status, 409);
    assert.equal(expired.body.meta.code, "attempt_expired");
    assert.equal(memory.attempts().some((attempt) => attempt.attemptId === "expiredVersionToken01"), false);
  });
});

function attemptBody(
  override: Partial<{
    attemptId: string;
    externalAuthorId: string;
    email: string;
    displayName: string;
    target: string;
    expiresAt: number;
  }> = {},
) {
  return {
    attemptId: "exampleAttemptToken_12",
    externalAuthorId: AUTHOR,
    email: "author@example.com",
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: RETURN_PATH,
    emailVerification: "pending" as const,
    ...override,
  };
}

function snapshotText(displayName = "Snapshot Public"): string {
  return JSON.stringify({
    version: 2,
    displayName,
    biography: "Public biography.",
  });
}

async function register(
  body: ReturnType<typeof attemptBody>,
  options: {
    version2: boolean;
    timestamp?: string;
    versionTimestamp?: string;
    versionSignature?: string;
    versionAttemptId?: string;
    versionTarget?: string;
    versionLine?: string;
    extraHeaders?: Record<string, string>;
  },
): Promise<{ status: number; body: ApiBody; timestamp: string; signature: string; versionSignature: string }> {
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionAttemptPayload({
      timestamp,
      attemptId: body.attemptId,
      externalAuthorId: body.externalAuthorId,
      email: body.email.trim().toLowerCase(),
      displayName: body.displayName.trim(),
      target: body.target,
      expiresAt: String(body.expiresAt),
      returnPath: body.returnPath,
      emailVerification: body.emailVerification,
    }),
  );
  const versionTimestamp = options.versionTimestamp ?? timestamp;
  const versionPayload = [
    INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE,
    versionTimestamp,
    options.versionAttemptId ?? body.attemptId,
    options.versionTarget ?? body.target,
    options.versionLine ?? "2",
  ].join("\n");
  const versionSignature =
    options.versionSignature ?? signIntegrityMediaLinkRedeem(SECRET, versionPayload);
  const response = await request("POST", "/provision-attempt", body, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
    ...(options.version2
      ? {
          "x-hu-integrity-media-version-timestamp": versionTimestamp,
          "x-hu-integrity-media-version-signature": versionSignature,
        }
      : {}),
    ...options.extraHeaders,
  });
  return { ...response, timestamp, signature, versionSignature };
}

async function snapshot(
  attemptId: string,
  fields: { displayName?: string } = {},
): Promise<{ status: number; body: ApiBody }> {
  const text = snapshotText(fields.displayName);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionSnapshotPayload({
      timestamp,
      attemptId,
      target: "staging",
      snapshot: text,
    }),
  );
  return request(
    "POST",
    "/provision-snapshot",
    { attemptId, target: "staging", snapshot: text },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}

async function confirm(state: string): Promise<{ status: number; body: ApiBody }> {
  return request("POST", "/provision-confirm", { state });
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${baseUrl}/api/v1/integrity-media/link${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as ApiBody,
  };
}

function existingUser(email: string, memberId: string, userId: string): AuthUserRecord {
  const now = new Date().toISOString();
  return {
    userId,
    email,
    passwordHash: "existing-hash",
    displayName: "Existing Person",
    role: "member",
    status: "active",
    memberId,
    emailVerificationStatus: "verified",
    createdAt: now,
    updatedAt: now,
  };
}

function confirmedLink(authorId: string, memberId: string): ExternalAuthorLinkRecord {
  const now = new Date().toISOString();
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: authorId,
    memberId,
    state: "linked",
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
    disconnectedAt: null,
    collaborationStatus: "active",
    linkRevision: 4,
    linkFinalization: "confirmed",
    linkInstanceId: "44444444-4444-4444-8444-444444444444",
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
