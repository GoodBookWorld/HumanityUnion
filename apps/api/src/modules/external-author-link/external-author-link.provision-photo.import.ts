import { createHash } from "node:crypto";

import { detectImageSignature } from "../media-upload/image-signature.js";
import { findMediaRecordByStorageKey, saveMediaRecordDurable } from "../media-upload/media-upload.service.js";
import { resolveMediaStorageProviderName } from "../media-upload/media-object-storage.js";
import { resolveMediaObjectStorage } from "../media-upload/resolve-media-object-storage.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";
import { fetchProvisionPhoto, type ProvisionPhotoFetchResult } from "./external-author-link.provision-photo.client.js";
import {
  currentProvisionDatabase,
  withProvisionLock,
  type ProvisionAttemptRecord,
  type ProvisionDatabase,
} from "./external-author-link.provision.database.js";
import {
  readImportableSnapshotPhoto,
  type ImportableSnapshotPhoto,
} from "./external-author-link.provision-snapshot.schema.js";

const PHOTO_IMPORT_MAX_ATTEMPTS = 2;
const PHOTO_IMPORT_LEASE_MS = 15_000;

export interface PreparedProvisionPhoto {
  prefetch: "skipped" | "ready" | "failed";
  bytes: Buffer | null;
  terminalFailure: boolean;
}

let beforeAvatarWrite: (() => Promise<void>) | null = null;
let afterPrefetch: (() => Promise<void>) | null = null;

/** Unit tests only. Runs after the object is stored and before the avatar compare-and-set. */
export function setProvisionPhotoBeforeAvatarWriteForTests(
  hook: (() => Promise<void>) | null,
): void {
  if (hook && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Provision photo test hook is unavailable.");
  }

  beforeAvatarWrite = hook;
}

/** Unit tests only. Runs after prefetch and before the Confirm transaction. */
export function setProvisionPhotoAfterPrefetchForTests(
  hook: (() => Promise<void>) | null,
): void {
  if (hook && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Provision photo test hook is unavailable.");
  }

  afterPrefetch = hook;
}

export async function runAfterProvisionPhotoPrefetchForTests(): Promise<void> {
  if (afterPrefetch) {
    await afterPrefetch();
  }
}

export async function prepareProvisionPhoto(
  attemptId: string,
  now: Date,
): Promise<PreparedProvisionPhoto> {
  try {
    return await prepareUnlocked(attemptId, now);
  } catch {
    return { prefetch: "failed", bytes: null, terminalFailure: false };
  }
}

export async function finishProvisionPhoto(
  attemptId: string,
  now: Date,
  prepared: PreparedProvisionPhoto,
): Promise<void> {
  try {
    await withProvisionLock(() => finishUnlocked(attemptId, now, prepared));
  } catch {
    // Photo import must not change a committed Confirm result.
  }
}

export async function establishNewParticipantPhotoEligibility(
  db: ProvisionDatabase,
  attempt: ProvisionAttemptRecord,
  updatedAt: string,
): Promise<void> {
  const photo = readImportableSnapshotPhoto(attempt.profileSnapshot);
  if (!photo || rawPlatformMode() !== "staging" || attempt.target !== "staging") {
    return;
  }

  await db.establishPhotoImportEligibility(
    attempt.attemptId,
    { digest: photo.digest, byteLength: photo.byteLength },
    updatedAt,
  );
}

async function prepareUnlocked(attemptId: string, now: Date): Promise<PreparedProvisionPhoto> {
  if (rawPlatformMode() !== "staging") {
    return { prefetch: "skipped", bytes: null, terminalFailure: false };
  }

  const db = currentProvisionDatabase();
  const attempt = await db.findAttempt(attemptId);
  if (!attempt || attempt.expiresAt <= unixSeconds(now) || attempt.target !== "staging") {
    return { prefetch: "skipped", bytes: null, terminalFailure: false };
  }

  const photo = readImportableSnapshotPhoto(attempt.profileSnapshot);
  if (!photo) {
    return { prefetch: "skipped", bytes: null, terminalFailure: false };
  }

  const status = attempt.photoImportStatus;
  const attempts = attempt.photoImportAttempts ?? 0;
  const recovering =
    attempt.createdMember === true &&
    (status === "pending" || status === "in_progress") &&
    attempts < PHOTO_IMPORT_MAX_ATTEMPTS;

  if (!recovering) {
    if (attempt.memberId || attempt.createdMember) {
      return { prefetch: "skipped", bytes: null, terminalFailure: false };
    }

    const [link, emailOwner] = await Promise.all([
      db.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, attempt.externalAuthorId),
      db.findUserByEmail(attempt.email),
    ]);
    if (link || emailOwner) {
      return { prefetch: "skipped", bytes: null, terminalFailure: false };
    }
  }

  const fetched = await fetchProvisionPhoto({
    attemptId: attempt.attemptId,
    digest: photo.digest,
    byteLength: photo.byteLength,
    now,
  });
  return preparedFromFetch(fetched);
}

function preparedFromFetch(fetched: ProvisionPhotoFetchResult): PreparedProvisionPhoto {
  if (fetched.ok) {
    return { prefetch: "ready", bytes: fetched.bytes, terminalFailure: false };
  }

  return {
    prefetch: "failed",
    bytes: null,
    terminalFailure: fetched.code === "missing" || fetched.code === "expired",
  };
}

async function finishUnlocked(
  attemptId: string,
  now: Date,
  prepared: PreparedProvisionPhoto,
): Promise<void> {
  const db = currentProvisionDatabase();
  const attempt = await db.findAttempt(attemptId);
  if (!attempt || attempt.createdMember !== true || attempt.expiresAt <= unixSeconds(now)) {
    return;
  }

  if (attempt.photoImportStatus !== "pending" && attempt.photoImportStatus !== "in_progress") {
    return;
  }

  const attempts = attempt.photoImportAttempts ?? 0;
  if (attempts >= PHOTO_IMPORT_MAX_ATTEMPTS) {
    return;
  }

  const leaseBeforeIso = new Date(now.getTime() - PHOTO_IMPORT_LEASE_MS).toISOString();
  const leaseHeld =
    attempt.photoImportStatus === "in_progress" &&
    typeof attempt.photoImportClaimedAt === "string" &&
    attempt.photoImportClaimedAt >= leaseBeforeIso;
  if (leaseHeld) {
    return;
  }

  const photo = readImportableSnapshotPhoto(attempt.profileSnapshot);
  if (!photo) {
    return;
  }

  if (resolveMediaStorageProviderName() !== "r2") {
    await settleFailure(db, attempt.attemptId, now, false);
    return;
  }

  const resolved = await resolveCommittedPhoto(attempt, photo, prepared, now);
  if (!resolved.ok) {
    await settleFailure(db, attempt.attemptId, now, resolved.terminalFailure);
    return;
  }

  const claimed = await db.claimPhotoImport({
    attemptId,
    nowSeconds: unixSeconds(now),
    nowIso: now.toISOString(),
    leaseBeforeIso,
    maxAttempts: PHOTO_IMPORT_MAX_ATTEMPTS,
  });
  if (claimed !== "claimed") {
    return;
  }

  try {
    const avatarUrl = await storePhoto(attempt, resolved.bytes);
    if (beforeAvatarWrite) {
      await beforeAvatarWrite();
    }

    const userId = attempt.userId;
    if (!userId) {
      await releaseCurrentClaim(db, attemptId, now, false);
      return;
    }

    const applied = await db.claimEmptyAvatar({
      userId,
      avatarUrl,
      updatedAt: now.toISOString(),
    });
    await db.settlePhotoImport(
      attemptId,
      applied === "applied" ? "applied" : "skipped",
      now.toISOString(),
    );
  } catch {
    await releaseCurrentClaim(db, attemptId, now, false);
  }
}

async function resolveCommittedPhoto(
  attempt: ProvisionAttemptRecord,
  photo: ImportableSnapshotPhoto,
  prepared: PreparedProvisionPhoto,
  now: Date,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; terminalFailure: boolean }> {
  if (prepared.prefetch === "ready" && prepared.bytes && photoBytesMatch(prepared.bytes, photo)) {
    return { ok: true, bytes: prepared.bytes };
  }

  const fetched = await fetchProvisionPhoto({
    attemptId: attempt.attemptId,
    digest: photo.digest,
    byteLength: photo.byteLength,
    now,
  });
  if (!fetched.ok) {
    return {
      ok: false,
      terminalFailure: fetched.code === "missing" || fetched.code === "expired",
    };
  }

  if (!photoBytesMatch(fetched.bytes, photo)) {
    return { ok: false, terminalFailure: false };
  }

  return { ok: true, bytes: fetched.bytes };
}

function photoBytesMatch(bytes: Buffer, photo: ImportableSnapshotPhoto): boolean {
  return (
    bytes.length === photo.byteLength &&
    detectImageSignature(bytes) === "image/webp" &&
    createHash("sha256").update(bytes).digest("hex") === photo.digest
  );
}

async function storePhoto(attempt: ProvisionAttemptRecord, bytes: Buffer): Promise<string> {
  const storageKey = photoStorageKey(attempt.attemptId);
  const existing = findMediaRecordByStorageKey(storageKey);
  if (existing) {
    return existing.mediaUrl;
  }

  const storage = resolveMediaObjectStorage();
  const stored = await storage.saveFile({
    purpose: "avatar",
    buffer: bytes,
    mimeType: "image/webp",
    extension: ".webp",
    storageKey,
  });
  const mediaUrl = storage.buildPublicUrl(stored.storageKey);
  await saveMediaRecordDurable({
    mediaId: `integrity-media-avatar-${attempt.attemptId}`,
    mediaUrl,
    mediaType: "image/webp",
    size: bytes.length,
    createdAt: new Date().toISOString(),
    ownerUserId: attempt.userId ?? "",
    ownerParticipantId: attempt.memberId ?? "",
    purpose: "avatar",
    storageKey: stored.storageKey,
  });
  return mediaUrl;
}

async function releaseCurrentClaim(
  db: ProvisionDatabase,
  attemptId: string,
  now: Date,
  terminal: boolean,
): Promise<void> {
  const current = await db.findAttempt(attemptId);
  if (!current) {
    return;
  }

  if (current.photoImportStatus !== "in_progress" && current.photoImportStatus !== "pending") {
    return;
  }

  const attempts = current.photoImportAttempts ?? 0;
  await db.settlePhotoImport(
    attemptId,
    terminal || attempts >= PHOTO_IMPORT_MAX_ATTEMPTS ? "failed" : "pending",
    now.toISOString(),
  );
}

async function settleFailure(
  db: ProvisionDatabase,
  attemptId: string,
  now: Date,
  terminal: boolean,
): Promise<void> {
  const claimed = await db.claimPhotoImport({
    attemptId,
    nowSeconds: unixSeconds(now),
    nowIso: now.toISOString(),
    leaseBeforeIso: new Date(now.getTime() - PHOTO_IMPORT_LEASE_MS).toISOString(),
    maxAttempts: PHOTO_IMPORT_MAX_ATTEMPTS,
  });
  if (claimed !== "claimed") {
    return;
  }

  const current = await db.findAttempt(attemptId);
  const attempts = current?.photoImportAttempts ?? 0;
  await db.settlePhotoImport(
    attemptId,
    terminal || attempts >= PHOTO_IMPORT_MAX_ATTEMPTS ? "failed" : "pending",
    now.toISOString(),
  );
}

function photoStorageKey(attemptId: string): string {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(attemptId)) {
    throw new Error("Invalid provision photo storage key.");
  }

  return `avatars/integrity-media/${attemptId}.webp`;
}

function rawPlatformMode(): string {
  return process.env.PLATFORM_MODE?.trim() ?? "";
}

function unixSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}
