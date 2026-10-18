import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import { signIntegrityMediaLinkRedeem } from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import { buildProvisionAttemptPayload, resetProvisionAttemptReplayCacheForTests } from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import {
  buildProvisionVersionPayload,
  resetProvisionVersionReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-version.hmac.js";
import {
  buildProvisionSnapshotPayload,
  resetProvisionSnapshotReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-snapshot.hmac.js";
import {
  MAX_PROVISION_SNAPSHOT_BYTES,
  parseApprovedProvisionSnapshot,
  readImportableSnapshotPhoto,
} from "../../../src/modules/external-author-link/external-author-link.provision-snapshot.schema.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import {
  createMemoryProvisionState,
  setProvisionMemoryForTests,
  type MemoryProvisionState,
} from "../../../src/modules/external-author-link/external-author-link.provision.database.js";
import {
  createMemoryExternalAuthorLinkStore,
  setExternalAuthorLinkStoreForTests,
  type ExternalAuthorLinkStore,
} from "../../../src/modules/external-author-link/external-author-link.store.js";
import { buildSsoGrantPayload } from "../../../src/modules/external-author-link/external-author-link.sso.hmac.js";
import integrityMediaAccountSsoRouter from "../../../src/modules/external-author-link/external-author-link.sso.routes.js";
import {
  createMemorySsoState,
  setSsoMemoryForTests,
  type MemorySsoState,
} from "../../../src/modules/external-author-link/external-author-link.sso.database.js";
import { buildNewPersistedMember } from "../../../src/modules/member/infrastructure/member.persistence.js";
import { DEFAULT_MEMBER_AVATAR_URL } from "../../../src/modules/member-profile/member-profile.constants.js";
import { toPublicMemberProfile } from "../../../src/modules/member-profile/member-profile.projection.js";
import { buildDefaultMemberProfile } from "../../../src/modules/member-profile/member-profile.repository.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";

const SECRET = "dummy-secret-not-real";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
const RETURN_PATH = "/api/author/humanity-union-link/complete";
const PROVISION_DIGEST = "bcb5016507f8fd5c0c32bb502ae88cd8b11f1182542a56d2dad893493af3580b";
const WEB_ORIGIN = "https://staging.huws.org";
const PHOTO_DIGEST = "ab".repeat(32);

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let server: Server;
let baseUrl = "";
let memory: MemoryProvisionState;
let linkStore: ExternalAuthorLinkStore;
let ssoMemory: MemorySsoState;
let previousMode: string | undefined;
let previousSecret: string | undefined;
let previousOrigin: string | undefined;
let previousWebOrigin: string | undefined;

describe("Integrity Media provision profile snapshot", () => {
  before(async () => {
    previousMode = process.env.PLATFORM_MODE;
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousOrigin = process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV];
    previousWebOrigin = process.env.WEB_ORIGIN;
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";
    process.env.WEB_ORIGIN = WEB_ORIGIN;

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    app.use("/api/v1/integrity-media/account", integrityMediaAccountSsoRouter);
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
    setSsoMemoryForTests(null);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
    restoreEnv(INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV, previousOrigin);
    restoreEnv("PLATFORM_MODE", previousMode);
    restoreEnv("WEB_ORIGIN", previousWebOrigin);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    process.env.PLATFORM_MODE = "staging";
    process.env.WEB_ORIGIN = WEB_ORIGIN;
    resetProvisionAttemptReplayCacheForTests();
    resetProvisionSnapshotReplayCacheForTests();
    resetProvisionVersionReplayCacheForTests();
    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    ssoMemory = createMemorySsoState();
    setSsoMemoryForTests(ssoMemory);
  });

  it("keeps the version-1 ten-line provision registration unchanged", async () => {
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
    assert.equal(signIntegrityMediaLinkRedeem(SECRET, payload), PROVISION_DIGEST);

    const created = await registerAttempt(attemptBody(), { version2: false });
    assert.equal(created.status, 200);
    assert.equal(created.body.data?.idempotent, false);
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);
    const confirmed = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users()[0]?.displayName, "Example Author");
    assert.equal(memory.participants()[0]?.displayName, "Example Author");
    assert.equal(memory.profiles()[0]?.displayName, "Example Author");
    assert.equal(memory.profiles()[0]?.biography, undefined);
    assert.equal(memory.profiles()[0]?.avatarUrl, undefined);
  });

  it("registers a signed version-2 snapshot and retries the same bytes", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const snapshot = snapshotText();
    const canonical = buildProvisionSnapshotPayload({
      timestamp: "1700000000",
      attemptId: "exampleAttemptToken_12",
      target: "staging",
      snapshot,
    });
    assert.deepEqual(canonical.split("\n"), [
      "integrity-media-account-provision-snapshot",
      "1700000000",
      "exampleAttemptToken_12",
      "staging",
      "2",
      createHash("sha256").update(snapshot, "utf8").digest("hex"),
    ]);
    assert.equal(canonical.endsWith("\n"), false);

    const stored = await registerSnapshot(snapshot);
    assert.equal(stored.status, 200);
    assert.equal(stored.body.data?.idempotent, false);
    assert.deepEqual(Object.keys(stored.body.data ?? {}).sort(), ["attemptId", "idempotent", "target"]);
    assert.equal(memory.attempts()[0]?.profileSnapshot, snapshot);
    assert.equal(memory.attempts()[0]?.expiresAt, attemptBody().expiresAt);

    const replay = await registerSnapshot(snapshot, {
      signature: stored.signature,
      timestamp: stored.timestamp,
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.body.meta.code, "replayed");

    const same = await registerSnapshot(snapshot, {
      timestamp: String(Number(stored.timestamp) + 1),
    });
    assert.equal(same.status, 200);
    assert.equal(same.body.data?.idempotent, true);
    assert.equal(memory.attempts().length, 1);
    assert.equal(memory.attempts()[0]?.profileSnapshot, snapshot);
  });

  it("rejects an invalid signature, timestamp, target, or payload", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const snapshot = snapshotText();

    const invalid = await registerSnapshot(snapshot, { signature: "a".repeat(64) });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.meta.code, "invalid_signature");

    const stale = await registerSnapshot(snapshot, {
      timestamp: String(Math.floor(Date.now() / 1000) - 301),
    });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.meta.code, "stale_timestamp");

    process.env.PLATFORM_MODE = "production";
    const crossed = await registerSnapshot(snapshot);
    assert.equal(crossed.status, 403);
    assert.equal(crossed.body.meta.code, "target_mismatch");
    process.env.PLATFORM_MODE = "staging";

    const otherTarget = await registerSnapshot(snapshot, {}, { target: "production" });
    assert.equal(otherTarget.status, 403);
    assert.equal(otherTarget.body.meta.code, "target_mismatch");

    const extra = await request(
      "POST",
      "/api/v1/integrity-media/link/provision-snapshot",
      { attemptId: "exampleAttemptToken_12", target: "staging", snapshot, email: "author@example.com" },
    );
    assert.equal(extra.status, 400);
    assert.equal(extra.body.meta.code, "unexpected_field");

    const objectSnapshot = await registerSnapshot(snapshot, {}, { snapshot: { version: 2 } });
    assert.equal(objectSnapshot.status, 400);
    assert.equal(objectSnapshot.body.meta.code, "invalid_request");

    const version = await registerSnapshot(JSON.stringify({ ...snapshotFields(), version: 1 }));
    assert.equal(version.status, 400);
    assert.equal(version.body.meta.code, "unsupported_snapshot_version");

    const oversized = await registerSnapshot(`${snapshot}${" ".repeat(MAX_PROVISION_SNAPSHOT_BYTES)}`);
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.meta.code, "payload_too_large");
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);
  });

  it("rejects a conflicting snapshot and keeps the first one under concurrency", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const first = snapshotText({ biography: "First public biography." });
    const second = snapshotText({ biography: "Second public biography." });
    const conflict = await registerSnapshot(second, {}, {}, first);
    assert.equal((await registerSnapshot(first)).status, 200);
    const rejected = await registerSnapshot(second);
    assert.equal(rejected.status, 409);
    assert.equal(rejected.body.meta.code, "snapshot_conflict");
    assert.equal(memory.attempts()[0]?.profileSnapshot, first);

    resetProvisionSnapshotReplayCacheForTests();
    const attemptId = "concurrentAttemptTok1";
    assert.equal((await registerAttempt(attemptBody({ attemptId }))).status, 200);
    const left = snapshotText({ biography: "Left public biography." });
    const right = snapshotText({ biography: "Right public biography." });
    const [one, two] = await Promise.all([
      registerSnapshot(left, {}, { attemptId }),
      registerSnapshot(right, {}, { attemptId }),
    ]);
    assert.deepEqual([one.status, two.status].sort(), [200, 409]);
    assert.equal(
      [one, two].find((response) => response.status === 409)?.body.meta.code,
      "snapshot_conflict",
    );
    const stored = memory.attempts().find((attempt) => attempt.attemptId === attemptId)?.profileSnapshot;
    assert.equal(stored === left || stored === right, true);
    assert.equal(conflict.status, 401);
  });

  it("rejects an unknown, expired, or consumed attempt without extending expiry", async () => {
    const missing = await registerSnapshot(snapshotText(), {}, { attemptId: "missingAttemptToken1" });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.meta.code, "attempt_not_found");

    const expiresAt = Math.floor(Date.now() / 1000) - 30;
    await memory.view().insertAttempt({
      ...attemptBody({ attemptId: "expiredAttemptToken01", expiresAt }),
      externalAuthorId: AUTHOR,
      email: "author@example.com",
      displayName: "Example Author",
      target: "staging",
      returnPath: RETURN_PATH,
      emailVerification: "pending",
      memberId: null,
      userId: null,
      createdMember: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const expired = await registerSnapshot(snapshotText(), {}, { attemptId: "expiredAttemptToken01" });
    assert.equal(expired.status, 410);
    assert.equal(expired.body.meta.code, "attempt_expired");
    assert.equal(memory.attempts().find((attempt) => attempt.attemptId === "expiredAttemptToken01")?.expiresAt, expiresAt);

    assert.equal((await registerAttempt(attemptBody(), { version2: false })).status, 200);
    assert.equal(
      (
        await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
          state: "exampleAttemptToken_12",
        })
      ).status,
      200,
    );
    const consumed = await registerSnapshot(snapshotText());
    assert.equal(consumed.status, 409);
    assert.equal(consumed.body.meta.code, "attempt_consumed");
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);
  });

  it("initializes a new Participant from approved public fields and leaves an existing one unchanged", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const snapshot = snapshotText();
    assert.equal((await registerSnapshot(snapshot)).status, 200);
    const confirmed = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(JSON.stringify(confirmed.body).includes("Public biography"), false);
    assert.equal(JSON.stringify(confirmed.body).includes(PHOTO_DIGEST), false);

    assert.equal(memory.users()[0]?.displayName, "Example Author");
    assert.equal(memory.users()[0]?.email, "author@example.com");
    assert.equal(memory.users()[0]?.role, "member");
    assert.equal(memory.participants().length, 1);
    assert.equal(memory.participants()[0]?.displayName, "Snapshot Public");
    assert.equal(memory.profiles().length, 1);
    const profile = memory.profiles()[0];
    assert.ok(profile);
    assert.equal(profile.displayName, "Snapshot Public");
    assert.equal(profile.publicName.startsWith("snapshot-public-"), true);
    assert.equal(profile.biography, "Public biography.");
    assert.equal(profile.website, "https://example.com/author");
    assert.equal(profile.linkedinUrl, "https://www.linkedin.com/in/example");
    assert.equal(profile.facebookUrl, "https://www.facebook.com/example");
    assert.equal(profile.youtubeUrl, "https://www.youtube.com/@example");
    assert.equal(profile.instagramUrl, "https://www.instagram.com/example");
    assert.equal(profile.xUrl, "https://x.com/example");
    assert.equal(profile.avatarUrl, undefined);
    assert.equal(profile.country, undefined);
    assert.equal(profile.organization, undefined);
    assert.deepEqual(profile.skills, []);

    const before = structuredClone(profile);
    const repeated = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(memory.profiles().length, 1);
    assert.deepEqual(memory.profiles()[0], before);
    assert.equal(memory.participants().length, 1);

    const existingAuthor = "22222222-2222-4222-8222-222222222222";
    const memberId = "33333333-3333-4333-8333-333333333333";
    const userId = "user-existing";
    const existingProfile = buildDefaultMemberProfile({
      userId,
      displayName: "Existing Person",
    });
    existingProfile.biography = "Original biography";
    await memory.view().insertUser(existingUser("existing@example.com", memberId, userId));
    await memory.view().insertProfile(existingProfile);
    await memory.view().insertParticipant(
      buildNewPersistedMember({
        memberId,
        identityId: userId,
        displayName: "Existing Person",
        uniqueName: "existing-person",
        verificationLevel: "none",
      }),
    );
    await memory.view().insertLink(confirmedLink(existingAuthor, memberId));
    assert.equal(
      (
        await registerAttempt(
          attemptBody({
            attemptId: "existingAttemptToken1",
            externalAuthorId: existingAuthor,
            email: "existing@example.com",
            displayName: "Existing Person",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await registerSnapshot(snapshotText({ displayName: "Should Not Transfer" }), {}, { attemptId: "existingAttemptToken1" })).status,
      200,
    );
    const reused = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: "existingAttemptToken1",
    });
    assert.equal(reused.status, 200);
    assert.equal(reused.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    const existing = memory.profiles().find((candidate) => candidate.userId === userId);
    assert.equal(existing?.displayName, "Existing Person");
    assert.equal(existing?.biography, "Original biography");
    assert.equal(existing?.website, undefined);
    assert.equal(memory.participants().find((participant) => participant.memberId === memberId)?.displayName, "Existing Person");
    assert.equal(memory.users().find((user) => user.userId === userId)?.displayName, "Existing Person");
  });

  it("rejects invalid profile fields and never stores photo metadata as an avatar", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const longBiography = await registerSnapshot(
      snapshotText({ biography: "x".repeat(2001) }),
    );
    assert.equal(longBiography.status, 400);
    assert.equal(longBiography.body.meta.code, "invalid_snapshot");

    const longName = await registerSnapshot(snapshotText({ displayName: "N".repeat(121) }));
    assert.equal(longName.status, 400);
    assert.equal(longName.body.meta.code, "invalid_snapshot");

    const badLink = await registerSnapshot(
      snapshotText({ linkedinUrl: "https://example.com/not-linkedin" }),
    );
    assert.equal(badLink.status, 400);
    assert.equal(badLink.body.meta.code, "invalid_snapshot");

    const telegram = JSON.stringify({ ...snapshotFields(), telegram: "@author" });
    const transferred = await registerSnapshot(telegram);
    assert.equal(transferred.status, 400);
    assert.equal(transferred.body.meta.code, "unexpected_field");

    const located = JSON.stringify({ ...snapshotFields(), country: "US" });
    assert.equal((await registerSnapshot(located)).status, 400);
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);

    const blank = snapshotText({ biography: "   " });
    assert.equal((await registerSnapshot(blank)).status, 200);
    assert.equal(
      (
        await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
          state: "exampleAttemptToken_12",
        })
      ).status,
      200,
    );
    const profile = memory.profiles()[0];
    assert.ok(profile);
    assert.equal(profile.biography, undefined);
    assert.equal(profile.avatarUrl, undefined);
    assert.equal(JSON.stringify(profile).includes(PHOTO_DIGEST), false);
    assert.equal(JSON.stringify(profile).includes("https://integrity.website"), false);

    const projected = toPublicMemberProfile(profile, {
      viewerIsAuthenticated: true,
      viewerIsOwner: false,
    });
    assert.equal(projected?.avatarUrl, DEFAULT_MEMBER_AVATAR_URL);
    assert.equal(JSON.stringify(projected).includes(PHOTO_DIGEST), false);
    assert.equal(JSON.stringify(projected).includes("data:"), false);
  });

  it("keeps snapshot contents out of consent, redeem, and SSO grant responses", async () => {
    assert.equal((await registerAttempt(attemptBody())).status, 200);
    const snapshot = snapshotText();
    const stored = await registerSnapshot(snapshot);
    assert.equal(stored.status, 200);
    assert.equal(JSON.stringify(stored.body).includes(snapshot), false);
    assert.equal(JSON.stringify(stored.body).includes(PHOTO_DIGEST), false);
    assert.equal(JSON.stringify(stored.body).includes(stored.signature), false);

    const consent = await request(
      "GET",
      "/api/v1/integrity-media/link/provision-consent?state=exampleAttemptToken_12",
    );
    assert.equal(consent.status, 200);
    assert.equal(consent.body.data?.displayName, "Example Author");
    assert.equal(JSON.stringify(consent.body).includes("Snapshot Public"), false);
    assert.equal(JSON.stringify(consent.body).includes("Public biography"), false);

    const confirmed = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: "exampleAttemptToken_12",
    });
    assert.equal(JSON.stringify(confirmed.body).includes(PHOTO_DIGEST), false);
    const link = memory.links()[0];
    const user = memory.users()[0];
    assert.ok(link);
    assert.ok(user);
    assert.equal(
      await linkStore.insertLink({ ...link, linkFinalization: "confirmed" }),
      "inserted",
    );
    ssoMemory.addUser(user);
    ssoMemory.addMember({ memberId: user.memberId, identityId: user.userId });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestId = "snapshotSsoRequest01";
    const signature = signIntegrityMediaLinkRedeem(
      SECRET,
      buildSsoGrantPayload({
        timestamp,
        requestId,
        externalAuthorId: AUTHOR,
        memberId: user.memberId,
        linkRevision: String(link.linkRevision),
        target: "staging",
      }),
    );
    const grant = await fetch(`${baseUrl}/api/v1/integrity-media/account/sso`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hu-integrity-media-timestamp": timestamp,
        "x-hu-integrity-media-signature": signature,
      },
      body: JSON.stringify({
        timestamp: Number(timestamp),
        requestId,
        externalAuthorId: AUTHOR,
        memberId: user.memberId,
        linkRevision: link.linkRevision,
        target: "staging",
      }),
    });
    const grantBody = await grant.json() as { success?: boolean; grantUrl?: string };
    assert.equal(grant.status, 200);
    assert.equal(JSON.stringify(grantBody).includes("Public biography"), false);
    assert.equal(JSON.stringify(grantBody).includes(PHOTO_DIGEST), false);
    assert.equal(JSON.stringify(grantBody).includes("Snapshot Public"), false);
    assert.equal(ssoMemory.grants().length, 1);
    const storedGrant = JSON.stringify(ssoMemory.grants()[0]);
    assert.equal(storedGrant.includes("profileSnapshot"), false);
    assert.equal(storedGrant.includes(PHOTO_DIGEST), false);
    assert.equal(storedGrant.includes("Public biography"), false);
    assert.equal(storedGrant.includes("Snapshot Public"), false);
    assert.deepEqual(Object.keys(ssoMemory.grants()[0] ?? {}).sort(), [
      "consumedAt",
      "createdAt",
      "expiresAt",
      "externalAuthorId",
      "grantId",
      "linkRevision",
      "memberId",
      "requestId",
      "target",
      "userId",
    ]);
  });

  it("accepts SHA-256 and sha256 spellings and keeps the signed snapshot bytes", async () => {
    const full = imWebpSnapshot("SHA-256");
    const parsed = parseApprovedProvisionSnapshot(full);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.fields.displayName, "Ada");
      assert.equal(parsed.fields.biography, "Bio");
      assert.equal(parsed.fields.facebookUrl, "https://www.facebook.com/example");
    }
    assert.deepEqual(readImportableSnapshotPhoto(full), {
      mediaType: "image/webp",
      byteLength: 12,
      digest: "cd".repeat(32),
    });

    const lowercase = imWebpSnapshot("sha256");
    assert.equal(parseApprovedProvisionSnapshot(lowercase).ok, true);
    assert.equal(readImportableSnapshotPhoto(lowercase)?.digest, "cd".repeat(32));

    for (const algorithm of ["SHA256", "sha-256", "md5"]) {
      const rejected = parseApprovedProvisionSnapshot(imWebpSnapshot(algorithm));
      assert.equal(rejected.ok, false);
      if (!rejected.ok) {
        assert.equal(rejected.code, "invalid_snapshot");
      }
      assert.equal(readImportableSnapshotPhoto(imWebpSnapshot(algorithm)), null);
    }

    const attemptId = "webpMetaAttemptTok001";
    assert.equal((await registerAttempt(attemptBody({ attemptId }))).status, 200);
    const unsupported = await registerSnapshot(imWebpSnapshot("SHA256"), {}, { attemptId });
    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.meta.code, "invalid_snapshot");
    assert.equal(memory.attempts()[0]?.profileSnapshot, undefined);

    const stored = await registerSnapshot(full, {}, { attemptId });
    assert.equal(stored.status, 200);
    assert.equal(memory.attempts()[0]?.profileSnapshot, full);
    assert.equal(memory.attempts()[0]?.profileSnapshotDigest, createHash("sha256").update(full, "utf8").digest("hex"));

    const confirmed = await request("POST", "/api/v1/integrity-media/link/provision-confirm", {
      state: attemptId,
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users()[0]?.displayName, "Example Author");
    assert.equal(memory.participants()[0]?.displayName, "Ada");
    assert.equal(memory.profiles()[0]?.biography, "Bio");
    assert.equal(memory.profiles()[0]?.facebookUrl, "https://www.facebook.com/example");
    assert.equal(memory.profiles()[0]?.avatarUrl, undefined);
    assert.equal(memory.attempts()[0]?.profileSnapshot, full);
  });

  it("accepts a valid snapshot at the byte ceiling and rejects one byte more", async () => {
    const attemptId = "byteLimitAttemptTok01";
    assert.equal((await registerAttempt(attemptBody({ attemptId }))).status, 200);
    const exact = snapshotAtByteLength(MAX_PROVISION_SNAPSHOT_BYTES);
    assert.equal(Buffer.byteLength(exact, "utf8"), MAX_PROVISION_SNAPSHOT_BYTES);
    assert.equal(parseApprovedProvisionSnapshot(exact).ok, true);
    const accepted = await registerSnapshot(exact, {}, { attemptId });
    assert.equal(accepted.status, 200);
    assert.equal(memory.attempts()[0]?.profileSnapshot, exact);

    const oversized = `${exact} `;
    assert.equal(Buffer.byteLength(oversized, "utf8"), MAX_PROVISION_SNAPSHOT_BYTES + 1);
    const rejected = await registerSnapshot(oversized, {}, { attemptId });
    assert.equal(rejected.status, 413);
    assert.equal(rejected.body.meta.code, "payload_too_large");
    assert.equal(memory.attempts()[0]?.profileSnapshot, exact);
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function attemptBody(
  override: Partial<{
    attemptId: string;
    externalAuthorId: string;
    email: string;
    displayName: string;
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
    emailVerification: "pending",
    ...override,
  };
}

function snapshotFields(
  override: Partial<{ displayName: string; biography: string; linkedinUrl: string }> = {},
) {
  return {
    version: 2,
    displayName: "Snapshot Public",
    biography: "Public biography.",
    website: "https://example.com/author",
    linkedinUrl: "https://www.linkedin.com/in/example",
    facebookUrl: "https://www.facebook.com/example",
    youtubeUrl: "https://www.youtube.com/@example",
    instagramUrl: "https://www.instagram.com/example",
    xUrl: "https://x.com/example",
    photo: {
      mediaType: "image/jpeg",
      width: 800,
      height: 800,
      byteLength: 12000,
      digestAlgorithm: "sha256",
      digest: PHOTO_DIGEST,
    },
    ...override,
  };
}

function snapshotText(
  override: Partial<{ displayName: string; biography: string; linkedinUrl: string }> = {},
): string {
  return JSON.stringify(snapshotFields(override));
}

function imWebpSnapshot(digestAlgorithm: string): string {
  return `{"version":2,"displayName":"Ada","biography":"Bio","photo":{"mediaType":"image/webp","width":512,"height":512,"byteLength":12,"digestAlgorithm":${JSON.stringify(digestAlgorithm)},"digest":"${"cd".repeat(32)}"},"facebookUrl":"https://www.facebook.com/example"}`;
}

function snapshotAtByteLength(targetBytes: number): string {
  const digest = "cd".repeat(32);
  const cjk = "\u4e00";
  const urls = {
    facebookUrl: "https://www.facebook.com/",
    youtubeUrl: "https://www.youtube.com/",
    linkedinUrl: "https://www.linkedin.com/",
    xUrl: "https://x.com/",
    website: "https://example.com/",
  };
  let biography = "";
  const build = (): string =>
    JSON.stringify({
      version: 2,
      displayName: "Ada",
      biography,
      photo: {
        mediaType: "image/webp",
        width: 512,
        height: 512,
        byteLength: 12,
        digestAlgorithm: "SHA-256",
        digest,
      },
      ...urls,
    });

  let text = build();
  while (Buffer.byteLength(text, "utf8") + 3 <= targetBytes) {
    if (biography.length < 2000) {
      biography += cjk;
      text = build();
      continue;
    }
    const next = (Object.keys(urls) as Array<keyof typeof urls>).find((name) => urls[name].length < 2048);
    if (!next) {
      break;
    }
    urls[next] += cjk;
    text = build();
  }

  if (Buffer.byteLength(text, "utf8") !== targetBytes) {
    throw new Error(`Snapshot builder stopped at ${Buffer.byteLength(text, "utf8")} bytes.`);
  }

  return text;
}

async function registerAttempt(
  body: ReturnType<typeof attemptBody>,
  options: { version2?: boolean } = { version2: true },
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
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
  const versionSignature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionVersionPayload({
      timestamp,
      attemptId: body.attemptId,
      target: body.target,
    }),
  );
  return request("POST", "/api/v1/integrity-media/link/provision-attempt", body, {
    "x-hu-integrity-media-timestamp": timestamp,
    "x-hu-integrity-media-signature": signature,
    ...(options.version2 === false
      ? {}
      : {
          "x-hu-integrity-media-version-timestamp": timestamp,
          "x-hu-integrity-media-version-signature": versionSignature,
        }),
  });
}

async function registerSnapshot(
  snapshot: string,
  override: { timestamp?: string; signature?: string } = {},
  bodyOverride: { attemptId?: string; target?: string; snapshot?: unknown } = {},
  signedSnapshot = snapshot,
): Promise<{ status: number; body: ApiBody; timestamp: string; signature: string }> {
  const timestamp = override.timestamp ?? String(Math.floor(Date.now() / 1000));
  const attemptId = bodyOverride.attemptId ?? "exampleAttemptToken_12";
  const target = bodyOverride.target ?? "staging";
  const signature =
    override.signature ??
    signIntegrityMediaLinkRedeem(
      SECRET,
      buildProvisionSnapshotPayload({
        timestamp,
        attemptId,
        target,
        snapshot: signedSnapshot,
      }),
    );
  const response = await request(
    "POST",
    "/api/v1/integrity-media/link/provision-snapshot",
    {
      attemptId,
      target,
      snapshot: bodyOverride.snapshot === undefined ? snapshot : bodyOverride.snapshot,
    },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
  return { ...response, timestamp, signature };
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${baseUrl}${path}`, {
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
