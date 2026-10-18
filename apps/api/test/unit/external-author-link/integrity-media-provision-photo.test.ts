import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { describe, it, before, after, beforeEach } from "node:test";

import cookieParser from "cookie-parser";
import express from "express";

import {
  INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV,
  INTEGRITY_MEDIA_SERVER_ORIGIN_ENV,
  INTEGRITY_MEDIA_SOURCE,
} from "../../../src/modules/external-author-link/external-author-link.constants.js";
import {
  integrityMediaLinkSignaturesEqual,
  signIntegrityMediaLinkRedeem,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
import { buildProvisionAttemptPayload, resetProvisionAttemptReplayCacheForTests } from "../../../src/modules/external-author-link/external-author-link.provision.hmac.js";
import {
  buildProvisionVersionPayload,
  resetProvisionVersionReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-version.hmac.js";
import {
  buildProvisionSnapshotPayload,
  resetProvisionSnapshotReplayCacheForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-snapshot.hmac.js";
import { buildProvisionPhotoPayload } from "../../../src/modules/external-author-link/external-author-link.provision-photo.hmac.js";
import {
  fetchProvisionPhoto,
  setProvisionPhotoTimeoutForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-photo.client.js";
import {
  setProvisionPhotoAfterPrefetchForTests,
  setProvisionPhotoBeforeAvatarWriteForTests,
} from "../../../src/modules/external-author-link/external-author-link.provision-photo.import.js";
import externalAuthorLinkRouter from "../../../src/modules/external-author-link/external-author-link.routes.js";
import { setIntegrityMediaAuthorCapabilityEnsurerForTests } from "../../../src/modules/external-author-link/external-author-link.service.js";
import {
  buildIntegrityMediaLinkAcknowledgePayload,
  buildIntegrityMediaLinkRedeemPayload,
} from "../../../src/modules/external-author-link/external-author-link.hmac.js";
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
import { buildNewPersistedMember } from "../../../src/modules/member/infrastructure/member.persistence.js";
import { MemoryMediaObjectStorage } from "../../../src/modules/media-upload/memory-media.provider.js";
import type { MediaObjectStorage } from "../../../src/modules/media-upload/media-object-storage.js";
import {
  findMediaRecordByStorageKey,
  resetMediaUploadMemoryStoreForTests,
} from "../../../src/modules/media-upload/media-upload.service.js";
import {
  __testOnly_resetMediaObjectStorage,
  setMediaObjectStorageForTests,
} from "../../../src/modules/media-upload/resolve-media-object-storage.js";
import { buildDefaultMemberProfile } from "../../../src/modules/member-profile/member-profile.repository.js";
import type { ExternalAuthorLinkRecord } from "../../../src/modules/external-author-link/external-author-link.types.js";

const SECRET = "dummy-secret-not-real";
const AUTHOR = "11111111-1111-4111-8111-111111111111";
const RETURN_PATH = "/api/author/humanity-union-link/complete";
const ATTEMPT_ID = "exampleAttemptToken_12";

type PhotoMode = "ok" | "bad-digest" | "short" | "png" | "missing" | "expired" | "conflict" | "unavailable" | "timeout";

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  meta: { code?: string };
  message: string;
}

let api: Server;
let photoServer: Server;
let apiUrl = "";
let photoOrigin = "";
let memory: MemoryProvisionState;
let linkStore: ExternalAuthorLinkStore;
let storage: MemoryMediaObjectStorage;
let uploads = 0;
let failUploads = 0;
let photoMode: PhotoMode = "ok";
let photoRequests = 0;
let previousMode: string | undefined;
let previousSecret: string | undefined;
let previousOrigin: string | undefined;
let previousServer: string | undefined;
let previousProvider: string | undefined;
const webp = buildWebp("frozen-webp");
const webpDigest = createHash("sha256").update(webp).digest("hex");
const otherWebp = buildWebp("other-frozen-webp");
const otherDigest = createHash("sha256").update(otherWebp).digest("hex");

describe("Integrity Media provision photo import", () => {
  before(async () => {
    previousMode = process.env.PLATFORM_MODE;
    previousSecret = process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV];
    previousOrigin = process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV];
    previousServer = process.env[INTEGRITY_MEDIA_SERVER_ORIGIN_ENV];
    previousProvider = process.env.MEDIA_STORAGE_PROVIDER;
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV] = SECRET;
    process.env[INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV] = "https://integrity.website";

    photoServer = createServer((request, response) => {
      void handlePhoto(request, response);
    });
    await listen(photoServer);
    photoOrigin = `http://127.0.0.1:${portOf(photoServer)}`;
    process.env[INTEGRITY_MEDIA_SERVER_ORIGIN_ENV] = photoOrigin;

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/v1/integrity-media/link", externalAuthorLinkRouter);
    api = createServer(app);
    await listen(api);
    apiUrl = `http://127.0.0.1:${portOf(api)}`;
  });

  after(async () => {
    setProvisionMemoryForTests(null);
    setExternalAuthorLinkStoreForTests(null);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(null);
    setProvisionPhotoTimeoutForTests(null);
    setProvisionPhotoBeforeAvatarWriteForTests(null);
    setProvisionPhotoAfterPrefetchForTests(null);
    setMediaObjectStorageForTests(null);
    __testOnly_resetMediaObjectStorage();
    restoreEnv("PLATFORM_MODE", previousMode);
    restoreEnv(INTEGRITY_MEDIA_LINK_HMAC_SECRET_ENV, previousSecret);
    restoreEnv(INTEGRITY_MEDIA_LINK_RETURN_ORIGIN_ENV, previousOrigin);
    restoreEnv(INTEGRITY_MEDIA_SERVER_ORIGIN_ENV, previousServer);
    restoreEnv("MEDIA_STORAGE_PROVIDER", previousProvider);
    await close(photoServer);
    await close(api);
  });

  beforeEach(() => {
    process.env.PLATFORM_MODE = "staging";
    process.env[INTEGRITY_MEDIA_SERVER_ORIGIN_ENV] = photoOrigin;
    process.env.MEDIA_STORAGE_PROVIDER = "r2";
    resetProvisionAttemptReplayCacheForTests();
    resetProvisionSnapshotReplayCacheForTests();
    resetProvisionVersionReplayCacheForTests();
    resetMediaUploadMemoryStoreForTests();
    setProvisionPhotoTimeoutForTests(null);
    setProvisionPhotoBeforeAvatarWriteForTests(null);
    setProvisionPhotoAfterPrefetchForTests(null);
    memory = createMemoryProvisionState();
    setProvisionMemoryForTests(memory);
    linkStore = createMemoryExternalAuthorLinkStore();
    setExternalAuthorLinkStoreForTests(linkStore);
    setIntegrityMediaAuthorCapabilityEnsurerForTests(async () => ({
      changed: false,
      capabilities: ["author"],
      publishWithoutManualReview: true,
    }));
    storage = new MemoryMediaObjectStorage();
    uploads = 0;
    failUploads = 0;
    photoMode = "ok";
    photoRequests = 0;
    setMediaObjectStorageForTests(countingStorage(storage));
  });

  it("retrieves a signed WEBP and stores it for a new Participant", async () => {
    assert.equal((await registerAttempt()).status, 200);
    assert.equal((await registerSnapshot(snapshotText())).status, 200);
    const before = memory.profiles();
    assert.equal(before.length, 0);

    const confirmed = await confirm(ATTEMPT_ID);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(typeof confirmed.body.data?.redirectUrl, "string");
    assert.equal(photoRequests, 1);
    assert.equal(uploads, 1);
    assert.equal(storage.objects.size, 1);

    const profile = memory.profiles()[0];
    const storageKey = `avatars/integrity-media/${ATTEMPT_ID}.webp`;
    assert.equal(profile?.avatarUrl, storage.buildPublicUrl(storageKey));
    assert.equal(profile?.avatarUrl?.includes("integrity.website"), false);
    assert.equal(profile?.avatarUrl?.startsWith("data:"), false);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "applied");
    assert.equal(findMediaRecordByStorageKey(storageKey)?.mediaUrl, profile?.avatarUrl);
    assert.equal(memory.users()[0]?.displayName, "Example Author");

    const repeated = await confirm(ATTEMPT_ID);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(uploads, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl, profile?.avatarUrl);
    assert.equal(memory.profiles().length, 1);

    const link = memory.links()[0];
    assert.ok(link);
    assert.equal(await linkStore.insertLink(link), "inserted");
    const result = memory.results()[0];
    assert.ok(result);
    await linkStore.insertResult(result);
    const redirect = new URL(String(confirmed.body.data?.redirectUrl));
    const redeemed = await redeem(String(redirect.searchParams.get("code")));
    assert.equal(redeemed.status, 200);
    assert.equal(JSON.stringify(redeemed.body).includes(webpDigest), false);
    const acknowledged = await acknowledge(redeemed.body);
    assert.equal(acknowledged.status, 200);
    assert.equal(acknowledged.body.data?.finalization, "confirmed");
  });

  it("rejects an incorrect digest, length, or format without setting an avatar", async () => {
    photoMode = "bad-digest";
    await provisionNew();
    const confirmed = await confirm(ATTEMPT_ID);
    assert.equal(confirmed.status, 200);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl, undefined);
    assert.equal(uploads, 0);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "pending");

    photoMode = "short";
    const directShort = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(directShort.ok, false);
    if (!directShort.ok) {
      assert.equal(directShort.code, "invalid_response");
    }

    photoMode = "png";
    const directPng = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: createHash("sha256").update(Buffer.from([0x89, 0x50, 0x4e, 0x47])).digest("hex"),
      byteLength: 4,
    });
    assert.equal(directPng.ok, false);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
  });

  it("reports timeout, a missing photo, and an expired IM attempt without rolling back Confirm", async () => {
    setProvisionPhotoTimeoutForTests(40);
    photoMode = "timeout";
    await provisionNew();
    const timedOut = await confirm(ATTEMPT_ID);
    assert.equal(timedOut.status, 200);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl, undefined);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "pending");

    photoMode = "missing";
    const missingFetch = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(missingFetch.ok, false);
    if (!missingFetch.ok) {
      assert.equal(missingFetch.code, "missing");
    }

    photoMode = "expired";
    const expired = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.code, "expired");
    }
  });

  it("classifies photo 409, 410, and 503 and still creates the Participant", async () => {
    photoMode = "conflict";
    const conflictStart = photoRequests;
    const conflict = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.code, "conflict");
    }
    assert.equal(photoRequests, conflictStart + 1);

    photoMode = "expired";
    const expiredStart = photoRequests;
    const expired = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.code, "expired");
    }
    assert.equal(photoRequests, expiredStart + 1);

    photoMode = "unavailable";
    const unavailableStart = photoRequests;
    const unavailable = await fetchProvisionPhoto({
      attemptId: ATTEMPT_ID,
      digest: webpDigest,
      byteLength: webp.length,
    });
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) {
      assert.equal(unavailable.code, "unavailable");
    }
    assert.equal(photoRequests, unavailableStart + 1);

    photoMode = "conflict";
    photoRequests = 0;
    await provisionNew("conflictAttemptToken1");
    const confirmed = await confirm("conflictAttemptToken1");
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users().length, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl, undefined);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "failed");
    assert.ok(photoRequests >= 1);
    assert.ok(photoRequests <= 2);
  });

  it("does not import a photo for an existing Participant or a version-1 attempt", async () => {
    const started = photoRequests;
    const memberId = "33333333-3333-4333-8333-333333333333";
    const userId = "user-existing";
    const existingAuthor = "22222222-2222-4222-8222-222222222222";
    const profile = buildDefaultMemberProfile({ userId, displayName: "Existing Person" });
    delete profile.avatarUrl;
    await memory.view().insertUser({
      userId,
      email: "existing@example.com",
      passwordHash: "existing-hash",
      displayName: "Existing Person",
      role: "member",
      status: "active",
      memberId,
      emailVerificationStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
    await memory.view().insertLink(confirmedLink(existingAuthor, memberId));
    assert.equal(
      (
        await registerAttempt({
          attemptId: "existingAttemptToken1",
          externalAuthorId: existingAuthor,
          email: "existing@example.com",
          displayName: "Existing Person",
        })
      ).status,
      200,
    );
    assert.equal(
      (await registerSnapshot(snapshotText(), { attemptId: "existingAttemptToken1" })).status,
      200,
    );
    const reused = await confirm("existingAttemptToken1");
    assert.equal(reused.status, 200);
    assert.equal(reused.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(photoRequests, started);
    assert.equal(uploads, 0);
    assert.equal(memory.profiles().find((item) => item.userId === userId)?.avatarUrl, undefined);
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === "existingAttemptToken1")?.photoImportStatus,
      undefined,
    );

    assert.equal(
      (await registerAttempt({ attemptId: "versionOneAttemptTok1" }, { version2: false })).status,
      200,
    );
    const plain = await confirm("versionOneAttemptTok1");
    assert.equal(plain.status, 200);
    assert.equal(plain.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.profiles().find((item) => item.displayName === "Example Author")?.avatarUrl, undefined);
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === "versionOneAttemptTok1")?.photoImportStatus,
      undefined,
    );
    assert.equal(uploads, 0);
  });

  it("keeps one upload under concurrent Confirm and recovers one interrupted import", async () => {
    await provisionNew("concurrentAttemptTok1");
    const [left, right] = await Promise.all([
      confirm("concurrentAttemptTok1"),
      confirm("concurrentAttemptTok1"),
    ]);
    assert.deepEqual([left.status, right.status], [200, 200]);
    assert.equal(memory.users().length, 1);
    assert.equal(uploads, 1);
    assert.equal(storage.objects.size, 1);
    assert.equal(memory.profiles().length, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl?.endsWith("concurrentAttemptTok1.webp"), true);

    failUploads = 1;
    uploads = 0;
    await provisionNew({
      attemptId: "failedAfterCommitTok",
      externalAuthorId: "55555555-5555-4555-8555-555555555555",
      email: "failed@example.com",
    });
    const failed = await confirm("failedAfterCommitTok");
    assert.equal(failed.status, 200);
    assert.equal(failed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(memory.users().some((user) => user.email === "failed@example.com"), true);
    const failedProfile = memory.profiles().find((item) => item.userId === memory.users().find((user) => user.email === "failed@example.com")?.userId);
    assert.equal(failedProfile?.avatarUrl, undefined);
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === "failedAfterCommitTok")?.photoImportStatus,
      "pending",
    );

    const recovered = await confirm("failedAfterCommitTok");
    assert.equal(recovered.status, 200);
    assert.equal(
      memory.profiles().find((item) => item.userId === failedProfile?.userId)?.avatarUrl?.endsWith(".webp"),
      true,
    );
    const uploadsAfterRecovery = uploads;
    const again = await confirm("failedAfterCommitTok");
    assert.equal(again.body.data?.provisionOutcome, "CONFIRMED_MAPPING_EXISTS");
    assert.equal(uploads, uploadsAfterRecovery);

    memory.patchAttempt("failedAfterCommitTok", {
      photoImportStatus: "in_progress",
      photoImportAttempts: 1,
      photoImportClaimedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const liveUserId = String(failedProfile?.userId);
    memory.patchProfile(liveUserId, { avatarUrl: undefined });
    const interrupted = await confirm("failedAfterCommitTok");
    assert.equal(interrupted.status, 200);
    assert.equal(uploads, uploadsAfterRecovery);
    assert.equal(memory.profiles().find((item) => item.userId === liveUserId)?.avatarUrl?.includes(".webp"), true);
  });

  it("does not overwrite a Participant avatar and does not upload without R2", async () => {
    await provisionNew({
      attemptId: "avatarClaimAttempt01",
      externalAuthorId: "66666666-6666-4666-8666-666666666666",
      email: "chosen@example.com",
    });
    setProvisionPhotoBeforeAvatarWriteForTests(async () => {
      const userId = memory.users().find((user) => user.email === "chosen@example.com")?.userId;
      assert.ok(userId);
      memory.patchProfile(userId, { avatarUrl: "https://cdn.example.com/chosen.webp" });
    });
    const changed = await confirm("avatarClaimAttempt01");
    assert.equal(changed.status, 200);
    assert.equal(
      memory.profiles()[0]?.avatarUrl,
      "https://cdn.example.com/chosen.webp",
    );
    assert.equal(memory.attempts()[0]?.photoImportStatus, "skipped");
    const afterChanged = uploads;
    await confirm("avatarClaimAttempt01");
    assert.equal(uploads, afterChanged);

    setProvisionPhotoBeforeAvatarWriteForTests(async () => {
      const userId = memory.users().at(-1)?.userId;
      assert.ok(userId);
      memory.patchProfile(userId, { avatarUrl: "" });
    });
    await provisionNew({
      attemptId: "clearedAvatarAttempt1",
      externalAuthorId: "77777777-7777-4777-8777-777777777777",
      email: "cleared@example.com",
    });
    const cleared = await confirm("clearedAvatarAttempt1");
    assert.equal(cleared.status, 200);
    assert.equal(memory.profiles().find((item) => item.avatarUrl === "")?.avatarUrl, "");
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === "clearedAvatarAttempt1")?.photoImportStatus,
      "skipped",
    );

    process.env.MEDIA_STORAGE_PROVIDER = "local";
    const beforeUploads = uploads;
    await provisionNew({
      attemptId: "localProviderAttempt1",
      externalAuthorId: "88888888-8888-4888-8888-888888888888",
      email: "local@example.com",
    });
    const local = await confirm("localProviderAttempt1");
    assert.equal(local.status, 200);
    assert.equal(local.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(
      memory.profiles().find((item) => item.displayName === "Snapshot Public" && item.avatarUrl === undefined) !== undefined,
      true,
    );
    assert.equal(uploads, beforeUploads);
    assert.equal(
      memory.attempts().find((attempt) => attempt.attemptId === "localProviderAttempt1")?.photoImportStatus,
      "pending",
    );

    memory.patchAttempt("localProviderAttempt1", {
      expiresAt: Math.floor(Date.now() / 1000) - 30,
    });
    const expired = await confirm("localProviderAttempt1");
    assert.equal(expired.status, 410);
    assert.equal(expired.body.meta.code, "attempt_expired");
    assert.equal(uploads, beforeUploads);
  });

  it("fetches the committed snapshot when prefetch ran before registration", async () => {
    const attemptId = "racePrefetchAttempt01";
    assert.equal(
      (
        await registerAttempt({
          attemptId,
          externalAuthorId: "99999999-9999-4999-8999-999999999991",
          email: "race@example.com",
        })
      ).status,
      200,
    );
    setProvisionPhotoAfterPrefetchForTests(async () => {
      assert.equal(photoRequests, 0);
      assert.equal((await registerSnapshot(snapshotText(), { attemptId })).status, 200);
    });
    const confirmed = await confirm(attemptId);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
    assert.equal(typeof confirmed.body.data?.redirectUrl, "string");
    assert.equal(photoRequests, 1);
    assert.equal(uploads, 1);
    assert.equal(memory.users().length, 1);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "applied");
    assert.equal(memory.attempts()[0]?.photoImportAttempts, 1);
    assert.equal(memory.profiles()[0]?.avatarUrl?.endsWith(`${attemptId}.webp`), true);
    assert.equal(storage.objects.get(`avatars/integrity-media/${attemptId}.webp`)?.equals(webp), true);
  });

  it("fetches again when prefetched bytes do not match the committed snapshot", async () => {
    const attemptId = "mismatchPhotoAttempt1";
    await provisionNew({
      attemptId,
      externalAuthorId: "99999999-9999-4999-8999-999999999993",
      email: "mismatch@example.com",
    });
    setProvisionPhotoAfterPrefetchForTests(async () => {
      assert.equal(photoRequests, 1);
      memory.patchAttempt(attemptId, { profileSnapshot: snapshotFor(otherDigest, otherWebp.length) });
    });
    const confirmed = await confirm(attemptId);
    assert.equal(confirmed.status, 200);
    assert.equal(photoRequests, 2);
    assert.equal(uploads, 1);
    assert.equal(memory.attempts()[0]?.photoImportStatus, "applied");
    assert.equal(
      storage.objects.get(`avatars/integrity-media/${attemptId}.webp`)?.equals(otherWebp),
      true,
    );
    assert.equal(confirmed.body.data?.provisionOutcome, "NEW_AUTHOR");
  });

  it("does not fetch or consume an import when version-2 Confirm is waiting for a snapshot", async () => {
    const attemptId = "waitingSnapshotTok01";
    assert.equal(
      (
        await registerAttempt({
          attemptId,
          externalAuthorId: "99999999-9999-4999-8999-999999999992",
          email: "waiting@example.com",
        })
      ).status,
      200,
    );
    const blocked = await confirm(attemptId);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.meta.code, "snapshot_required");
    assert.equal(photoRequests, 0);
    assert.equal(uploads, 0);
    assert.equal(memory.users().length, 0);
    assert.equal(memory.attempts()[0]?.memberId, null);
    assert.equal(memory.attempts()[0]?.photoImportStatus, undefined);
    assert.equal(memory.attempts()[0]?.photoImportAttempts, undefined);
  });
});

function countingStorage(inner: MemoryMediaObjectStorage): MediaObjectStorage {
  return {
    buildPublicUrl(storageKey) {
      return inner.buildPublicUrl(storageKey);
    },
    async deleteFile(storageKey) {
      await inner.deleteFile(storageKey);
    },
    async saveFile(input) {
      uploads += 1;
      if (uploads <= failUploads) {
        throw new Error("storage unavailable");
      }

      return inner.saveFile(input);
    },
  };
}

async function handlePhoto(request: IncomingMessage, response: ServerResponse): Promise<void> {
  photoRequests += 1;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    attemptId?: string;
    target?: string;
    digest?: string;
    byteLength?: number;
  };
  const timestamp = String(request.headers["x-hu-integrity-media-timestamp"] ?? "");
  const signature = String(request.headers["x-hu-integrity-media-signature"] ?? "");
  const expected = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionPhotoPayload({
      timestamp,
      attemptId: String(body.attemptId),
      target: String(body.target),
      digest: String(body.digest),
      byteLength: Number(body.byteLength),
    }),
  );
  if (!integrityMediaLinkSignaturesEqual(expected, signature) || body.target !== "staging") {
    response.writeHead(401);
    response.end();
    return;
  }

  if (photoMode === "timeout") {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (response.destroyed) {
      return;
    }
  }

  if (photoMode === "missing") {
    response.writeHead(404);
    response.end();
    return;
  }

  if (photoMode === "expired") {
    response.writeHead(410);
    response.end();
    return;
  }

  if (photoMode === "conflict") {
    response.writeHead(409);
    response.end();
    return;
  }

  if (photoMode === "unavailable") {
    response.writeHead(503);
    response.end();
    return;
  }

  try {
    if (photoMode === "png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      return;
    }

    const bytes = Buffer.from(fixtureFor(body.digest, body.byteLength));
    if (photoMode === "bad-digest" && bytes.length > 12) {
      bytes[12] ^= 0xff;
    }
    const payload = photoMode === "short" ? bytes.subarray(0, 8) : bytes;
    response.writeHead(200, {
      "content-type": "image/webp",
      "content-length": String(payload.length),
    });
    response.end(payload);
  } catch {
    response.destroy();
  }
}

function fixtureFor(digest: string | undefined, byteLength: number | undefined): Buffer {
  if (digest === otherDigest && byteLength === otherWebp.length) {
    return otherWebp;
  }

  return webp;
}

function buildWebp(seed: string): Buffer {
  const payload = Buffer.from(seed);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(4 + payload.length);
  return Buffer.concat([Buffer.from("RIFF"), size, Buffer.from("WEBP"), payload]);
}

function snapshotText(): string {
  return snapshotFor(webpDigest, webp.length);
}

function snapshotFor(digest: string, byteLength: number): string {
  return JSON.stringify({
    version: 2,
    displayName: "Snapshot Public",
    photo: {
      mediaType: "image/webp",
      width: 32,
      height: 32,
      byteLength,
      digestAlgorithm: "sha256",
      digest,
    },
  });
}

async function provisionNew(
  input: { attemptId?: string; externalAuthorId?: string; email?: string } | string = {},
): Promise<void> {
  const fields = typeof input === "string" ? { attemptId: input } : input;
  assert.equal((await registerAttempt(fields)).status, 200);
  assert.equal((await registerSnapshot(snapshotText(), { attemptId: fields.attemptId ?? ATTEMPT_ID })).status, 200);
}

async function registerAttempt(
  override: Partial<{
    attemptId: string;
    externalAuthorId: string;
    email: string;
    displayName: string;
  }> = {},
  options: { version2?: boolean } = { version2: true },
) {
  const body = {
    attemptId: ATTEMPT_ID,
    externalAuthorId: AUTHOR,
    email: "author@example.com",
    displayName: "Example Author",
    target: "staging",
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    returnPath: RETURN_PATH,
    emailVerification: "pending",
    ...override,
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionAttemptPayload({
      timestamp,
      attemptId: body.attemptId,
      externalAuthorId: body.externalAuthorId,
      email: body.email,
      displayName: body.displayName,
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

async function registerSnapshot(snapshot: string, override: { attemptId?: string } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const attemptId = override.attemptId ?? ATTEMPT_ID;
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildProvisionSnapshotPayload({
      timestamp,
      attemptId,
      target: "staging",
      snapshot,
    }),
  );
  return request(
    "POST",
    "/api/v1/integrity-media/link/provision-snapshot",
    { attemptId, target: "staging", snapshot },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}

async function confirm(state: string) {
  return request("POST", "/api/v1/integrity-media/link/provision-confirm", { state });
}

async function redeem(code: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIntegrityMediaLinkRedeem(
    SECRET,
    buildIntegrityMediaLinkRedeemPayload({
      timestamp,
      resultCode: code,
      externalAuthorId: AUTHOR,
    }),
  );
  return request(
    "POST",
    "/api/v1/integrity-media/link/redeem",
    { resultCode: code, externalAuthorId: AUTHOR },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}

async function acknowledge(body: ApiBody) {
  const data = body.data ?? {};
  const eventId = "99999999-9999-4999-8999-999999999999";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const externalAuthorId = String(data.externalAuthorId);
  const memberId = String(data.memberId);
  const linkRevision = Number(data.linkRevision);
  const linkInstanceId = String(data.linkInstanceId);
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
  return request(
    "POST",
    "/api/v1/integrity-media/link/acknowledge",
    { eventId, externalAuthorId, memberId, linkRevision, linkInstanceId },
    {
      "x-hu-integrity-media-timestamp": timestamp,
      "x-hu-integrity-media-signature": signature,
    },
  );
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as ApiBody };
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

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function portOf(server: Server): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind.");
  }

  return address.port;
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
