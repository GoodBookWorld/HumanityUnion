/**
 * HU-NOTIF-02C.4 — aggregate digest run ledger (stable digestId = bucket key).
 * Unique digestId prevents duplicate period sends across workers.
 */

import type { MemberNotificationEmailDigestRunRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS } from "./member-notification-email-delivery.constants.js";

interface DigestRunDocument extends MemberNotificationEmailDigestRunRecord {
  _id?: string;
}

const memoryDigestRuns: MemberNotificationEmailDigestRunRecord[] = [];
let forceMemoryForTests = false;

export function setMemberNotificationEmailDigestRunForceMemoryForTests(
  enabled: boolean,
): void {
  forceMemoryForTests = enabled;
}

export function resetMemberNotificationEmailDigestRunStoreForTests(): void {
  memoryDigestRuns.length = 0;
}

function shouldUseMemory(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function stripRun(document: DigestRunDocument): MemberNotificationEmailDigestRunRecord {
  const { _id: _ignored, ...record } = document;
  return record;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export async function findMemberNotificationEmailDigestRunById(
  digestId: string,
): Promise<MemberNotificationEmailDigestRunRecord | null> {
  if (shouldUseMemory()) {
    return memoryDigestRuns.find((row) => row.digestId === digestId) ?? null;
  }
  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  const document = await collection.findOne({ digestId });
  return document ? stripRun(document) : null;
}

export async function listMemberNotificationEmailDigestRunsForTests(): Promise<
  MemberNotificationEmailDigestRunRecord[]
> {
  if (shouldUseMemory()) {
    return memoryDigestRuns.map((row) => structuredClone(row));
  }
  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  const documents = await collection.find({}).toArray();
  return documents.map(stripRun);
}

/**
 * Insert digest run if missing. Unique digestId makes concurrent creates idempotent.
 */
export async function ensureMemberNotificationEmailDigestRun(
  record: MemberNotificationEmailDigestRunRecord,
): Promise<{ record: MemberNotificationEmailDigestRunRecord; inserted: boolean }> {
  if (shouldUseMemory()) {
    const existing = memoryDigestRuns.find((row) => row.digestId === record.digestId);
    if (existing) {
      return { record: structuredClone(existing), inserted: false };
    }
    memoryDigestRuns.push(structuredClone(record));
    return { record: structuredClone(record), inserted: true };
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  try {
    await collection.insertOne(record);
    return { record, inserted: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await findMemberNotificationEmailDigestRunById(record.digestId);
    if (existing) {
      return { record: existing, inserted: false };
    }
    throw error;
  }
}

function isClaimableDigestRun(
  row: MemberNotificationEmailDigestRunRecord,
  nowIso: string,
): boolean {
  if (row.status === "pending" || row.status === "failed") {
    if (row.attemptCount >= row.maxAttempts) {
      return false;
    }
    return !row.nextAttemptAt || row.nextAttemptAt <= nowIso;
  }
  if (row.status === "claimed") {
    return Boolean(row.leaseExpiresAt && row.leaseExpiresAt <= nowIso);
  }
  return false;
}

/**
 * Atomically claim the next due digest run. Never claims dry_run_ok / sent / cancelled.
 */
export async function claimNextMemberNotificationEmailDigestRun(input: {
  leaseOwner: string;
  leaseExpiresAt: string;
}): Promise<MemberNotificationEmailDigestRunRecord | null> {
  const nowIso = new Date().toISOString();

  if (shouldUseMemory()) {
    const index = memoryDigestRuns.findIndex((row) => isClaimableDigestRun(row, nowIso));
    if (index < 0) {
      return null;
    }
    const candidate = memoryDigestRuns[index]!;
    if (!isClaimableDigestRun(candidate, nowIso)) {
      return null;
    }
    const updated: MemberNotificationEmailDigestRunRecord = {
      ...candidate,
      status: "claimed",
      leaseOwner: input.leaseOwner,
      leaseExpiresAt: input.leaseExpiresAt,
      attemptCount: candidate.attemptCount + 1,
      updatedAt: nowIso,
    };
    if (updated.attemptCount > updated.maxAttempts) {
      memoryDigestRuns[index] = {
        ...updated,
        status: "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: "max_attempts",
        nextAttemptAt: null,
      };
      return null;
    }
    memoryDigestRuns[index] = updated;
    return structuredClone(updated);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );

  const claimed = await collection.findOneAndUpdate(
    {
      $or: [
        {
          status: "pending",
          attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
          $or: [
            { nextAttemptAt: null },
            { nextAttemptAt: { $exists: false } },
            { nextAttemptAt: { $lte: nowIso } },
          ],
        },
        {
          status: "failed",
          attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
          $or: [
            { nextAttemptAt: null },
            { nextAttemptAt: { $exists: false } },
            { nextAttemptAt: { $lte: nowIso } },
          ],
        },
        {
          status: "claimed",
          leaseExpiresAt: { $lte: nowIso },
        },
      ],
    } as never,
    {
      $set: {
        status: "claimed",
        leaseOwner: input.leaseOwner,
        leaseExpiresAt: input.leaseExpiresAt,
        updatedAt: nowIso,
      },
      $inc: { attemptCount: 1 },
    },
    { sort: { nextAttemptAt: 1, createdAt: 1 }, returnDocument: "after" },
  );

  if (!claimed) {
    return null;
  }

  if (claimed.attemptCount > claimed.maxAttempts) {
    await collection.updateOne(
      { digestId: claimed.digestId, leaseOwner: input.leaseOwner },
      {
        $set: {
          status: "failed",
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: "max_attempts",
          updatedAt: nowIso,
          nextAttemptAt: null,
        },
      },
    );
    return null;
  }

  return stripRun(claimed);
}

/**
 * Reopen a terminal digest run when residual open children remain for the bucket.
 * Prevents permanent orphaning after partial child completion.
 */
export async function reopenMemberNotificationEmailDigestRunForResiduals(
  digestId: string,
): Promise<MemberNotificationEmailDigestRunRecord | null> {
  const nowIso = new Date().toISOString();
  const terminal = new Set(["dry_run_ok", "sent", "cancelled", "failed", "skipped"]);

  if (shouldUseMemory()) {
    const index = memoryDigestRuns.findIndex((row) => row.digestId === digestId);
    if (index < 0) {
      return null;
    }
    const current = memoryDigestRuns[index]!;
    if (!terminal.has(current.status) && current.status !== "claimed") {
      return structuredClone(current);
    }
    // Do not steal an active unexpired lease.
    if (
      current.status === "claimed" &&
      current.leaseExpiresAt &&
      current.leaseExpiresAt > nowIso
    ) {
      return structuredClone(current);
    }
    const updated: MemberNotificationEmailDigestRunRecord = {
      ...current,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: nowIso,
      leaseOwner: null,
      leaseExpiresAt: null,
      skipReason: null,
      lastErrorCode: null,
      providerEmailId: null,
      includedDeliveryIds: [],
      updatedAt: nowIso,
    };
    memoryDigestRuns[index] = updated;
    return structuredClone(updated);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  const result = await collection.findOneAndUpdate(
    {
      digestId,
      $or: [
        { status: { $in: ["dry_run_ok", "sent", "cancelled", "failed", "skipped"] } },
        { status: "claimed", leaseExpiresAt: { $lte: nowIso } },
      ],
    } as never,
    {
      $set: {
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: nowIso,
        leaseOwner: null,
        leaseExpiresAt: null,
        skipReason: null,
        lastErrorCode: null,
        providerEmailId: null,
        includedDeliveryIds: [],
        updatedAt: nowIso,
      },
    },
    { returnDocument: "after" },
  );
  return result ? stripRun(result) : findMemberNotificationEmailDigestRunById(digestId);
}

export async function updateMemberNotificationEmailDigestRun(
  digestId: string,
  patch: Partial<MemberNotificationEmailDigestRunRecord>,
  options: {
    expectedLeaseOwner?: string;
    requireClaimedStatus?: boolean;
  } = {},
): Promise<MemberNotificationEmailDigestRunRecord | null> {
  const nowIso = new Date().toISOString();
  const requireClaimed =
    options.requireClaimedStatus !== false && Boolean(options.expectedLeaseOwner);

  if (shouldUseMemory()) {
    const index = memoryDigestRuns.findIndex((row) => row.digestId === digestId);
    if (index < 0) {
      return null;
    }
    const current = memoryDigestRuns[index]!;
    if (options.expectedLeaseOwner && current.leaseOwner !== options.expectedLeaseOwner) {
      return null;
    }
    if (requireClaimed && current.status !== "claimed") {
      return null;
    }
    const updated = { ...current, ...patch, updatedAt: nowIso };
    memoryDigestRuns[index] = updated;
    return structuredClone(updated);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DigestRunDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  const filter: Record<string, unknown> = { digestId };
  if (options.expectedLeaseOwner) {
    filter.leaseOwner = options.expectedLeaseOwner;
  }
  if (requireClaimed) {
    filter.status = "claimed";
  }
  const result = await collection.findOneAndUpdate(
    filter,
    { $set: { ...patch, updatedAt: nowIso } },
    { returnDocument: "after" },
  );
  return result ? stripRun(result) : null;
}
