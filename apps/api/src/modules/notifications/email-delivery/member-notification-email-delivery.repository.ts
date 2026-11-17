/**
 * HU-NOTIF-02C.1 — Mongo + memory ledger repository.
 * No SMTP. Idempotent insert by (notificationId, channel).
 */

import type {
  MemberNotificationEmailDeliveryGapRecord,
  MemberNotificationEmailDeliveryRecord,
} from "@hu/types";
import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS } from "./member-notification-email-delivery.constants.js";

interface DeliveryDocument extends MemberNotificationEmailDeliveryRecord {
  _id?: string;
}

interface GapDocument extends MemberNotificationEmailDeliveryGapRecord {
  _id?: string;
}

const memoryDeliveries: MemberNotificationEmailDeliveryRecord[] = [];
const memoryGaps: MemberNotificationEmailDeliveryGapRecord[] = [];
let forceMemoryForTests = false;

export function setMemberNotificationEmailDeliveryForceMemoryForTests(
  enabled: boolean,
): void {
  forceMemoryForTests = enabled;
}

export function resetMemberNotificationEmailDeliveryStoreForTests(): void {
  memoryDeliveries.length = 0;
  memoryGaps.length = 0;
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

function stripDelivery(document: DeliveryDocument): MemberNotificationEmailDeliveryRecord {
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

export async function findMemberNotificationEmailDeliveryByNotificationAndChannel(input: {
  notificationId: string;
  channel: MemberNotificationEmailDeliveryRecord["channel"];
}): Promise<MemberNotificationEmailDeliveryRecord | null> {
  if (shouldUseMemory()) {
    return (
      memoryDeliveries.find(
        (row) =>
          row.notificationId === input.notificationId && row.channel === input.channel,
      ) ?? null
    );
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const document = await collection.findOne({
    notificationId: input.notificationId,
    channel: input.channel,
  });
  return document ? stripDelivery(document) : null;
}

export async function findMemberNotificationEmailDeliveryById(
  deliveryId: string,
): Promise<MemberNotificationEmailDeliveryRecord | null> {
  if (shouldUseMemory()) {
    return memoryDeliveries.find((row) => row.deliveryId === deliveryId) ?? null;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const document = await collection.findOne({ deliveryId });
  return document ? stripDelivery(document) : null;
}

export async function listMemberNotificationEmailDeliveriesForTests(): Promise<
  MemberNotificationEmailDeliveryRecord[]
> {
  if (shouldUseMemory()) {
    return memoryDeliveries.map((row) => structuredClone(row));
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const documents = await collection.find({}).toArray();
  return documents.map(stripDelivery);
}

/**
 * Insert ledger row. On duplicate (notificationId, channel), returns existing.
 */
export async function insertMemberNotificationEmailDelivery(
  record: MemberNotificationEmailDeliveryRecord,
  options: { session?: ClientSession } = {},
): Promise<{ record: MemberNotificationEmailDeliveryRecord; inserted: boolean }> {
  if (shouldUseMemory()) {
    const existing = memoryDeliveries.find(
      (row) =>
        row.notificationId === record.notificationId && row.channel === record.channel,
    );
    if (existing) {
      return { record: structuredClone(existing), inserted: false };
    }
    if (memoryDeliveries.some((row) => row.deliveryId === record.deliveryId)) {
      return { record: structuredClone(record), inserted: false };
    }
    memoryDeliveries.push(structuredClone(record));
    return { record: structuredClone(record), inserted: true };
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );

  try {
    await collection.insertOne(record, options.session ? { session: options.session } : undefined);
    return { record, inserted: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await findMemberNotificationEmailDeliveryByNotificationAndChannel({
      notificationId: record.notificationId,
      channel: record.channel,
    });
    if (existing) {
      return { record: existing, inserted: false };
    }
    throw error;
  }
}

/**
 * Stable gap identity: gapId === notificationId (one gap row per notification).
 * Re-recording updates reason without creating duplicates.
 */
export async function recordMemberNotificationEmailDeliveryGap(input: {
  notificationId: string;
  recipientUserId: string;
  eventType: MemberNotificationEmailDeliveryRecord["eventType"];
  reason: string;
}): Promise<MemberNotificationEmailDeliveryGapRecord> {
  const now = new Date().toISOString();
  const reason = input.reason.slice(0, 500);

  if (shouldUseMemory()) {
    const existingIndex = memoryGaps.findIndex(
      (gap) => gap.notificationId === input.notificationId,
    );
    if (existingIndex >= 0) {
      const existing = memoryGaps[existingIndex]!;
      const updated: MemberNotificationEmailDeliveryGapRecord = {
        ...existing,
        reason,
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
      };
      memoryGaps[existingIndex] = updated;
      return structuredClone(updated);
    }
    const gap: MemberNotificationEmailDeliveryGapRecord = {
      gapId: input.notificationId,
      notificationId: input.notificationId,
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      reason,
      createdAt: now,
    };
    memoryGaps.push(structuredClone(gap));
    return structuredClone(gap);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<GapDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveryGaps,
  );

  const existing = await collection.findOne({ notificationId: input.notificationId });
  if (existing) {
    await collection.updateOne(
      { notificationId: input.notificationId },
      {
        $set: {
          reason,
          recipientUserId: input.recipientUserId,
          eventType: input.eventType,
        },
      },
    );
    const { _id: _ignored, ...record } = existing;
    return {
      ...record,
      reason,
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
    };
  }

  const gap: MemberNotificationEmailDeliveryGapRecord = {
    gapId: input.notificationId,
    notificationId: input.notificationId,
    recipientUserId: input.recipientUserId,
    eventType: input.eventType,
    reason,
    createdAt: now,
  };

  try {
    await collection.insertOne(gap);
    return gap;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const raced = await collection.findOne({ notificationId: input.notificationId });
    if (!raced) {
      throw error;
    }
    const { _id: _ignored, ...record } = raced;
    return record;
  }
}

export async function listMemberNotificationEmailDeliveryGaps(input?: {
  sinceIso?: string;
}): Promise<MemberNotificationEmailDeliveryGapRecord[]> {
  if (shouldUseMemory()) {
    return memoryGaps
      .filter((gap) => !input?.sinceIso || gap.createdAt >= input.sinceIso)
      .map((gap) => structuredClone(gap));
  }

  await ensureMongoReady();
  const collection = getMongoCollection<GapDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveryGaps,
  );
  const query = input?.sinceIso ? { createdAt: { $gte: input.sinceIso } } : {};
  const documents = await collection.find(query).sort({ createdAt: 1 }).toArray();
  return documents.map(({ _id: _ignored, ...record }) => record);
}

function isClaimableRow(
  row: MemberNotificationEmailDeliveryRecord,
  nowIso: string,
): boolean {
  if (row.channel !== "immediate") {
    return false;
  }
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
 * Atomically claim the next due immediate delivery for this lease owner.
 * Recovers expired leases. Digests / dry_run_ok / sent / cancelled are never claimed.
 */
export async function claimNextMemberNotificationEmailDelivery(input: {
  leaseOwner: string;
  leaseExpiresAt: string;
  activationAt: string;
}): Promise<MemberNotificationEmailDeliveryRecord | null> {
  const nowIso = new Date().toISOString();

  if (shouldUseMemory()) {
    const index = memoryDeliveries.findIndex(
      (row) =>
        row.createdAt >= input.activationAt && isClaimableRow(row, nowIso),
    );
    if (index < 0) {
      return null;
    }
    const candidate = memoryDeliveries[index]!;
    // Re-check claimability at write time to reject a raced concurrent claim.
    if (!isClaimableRow(candidate, nowIso)) {
      return null;
    }
    const updated: MemberNotificationEmailDeliveryRecord = {
      ...candidate,
      status: "claimed",
      leaseOwner: input.leaseOwner,
      leaseExpiresAt: input.leaseExpiresAt,
      attemptCount: candidate.attemptCount + 1,
      updatedAt: nowIso,
    };
    if (updated.attemptCount > updated.maxAttempts) {
      memoryDeliveries[index] = {
        ...updated,
        status: "failed",
        leaseOwner: null,
        leaseExpiresAt: null,
        lastErrorCode: "max_attempts",
        nextAttemptAt: null,
      };
      return null;
    }
    memoryDeliveries[index] = updated;
    return structuredClone(updated);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );

  const claimFilter: Record<string, unknown> = {
    channel: "immediate" as const,
    createdAt: { $gte: input.activationAt },
    $or: [
      {
        status: "pending" as const,
        attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
        $or: [
          { nextAttemptAt: null },
          { nextAttemptAt: { $exists: false } },
          { nextAttemptAt: { $lte: nowIso } },
        ],
      },
      {
        status: "failed" as const,
        attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
        $or: [
          { nextAttemptAt: null },
          { nextAttemptAt: { $exists: false } },
          { nextAttemptAt: { $lte: nowIso } },
        ],
      },
      {
        status: "claimed" as const,
        leaseExpiresAt: { $lte: nowIso },
      },
    ],
  };

  const claimed = await collection.findOneAndUpdate(
    claimFilter as never,
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
      { deliveryId: claimed.deliveryId, leaseOwner: input.leaseOwner },
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

  return stripDelivery(claimed);
}

export async function updateMemberNotificationEmailDelivery(
  deliveryId: string,
  patch: Partial<MemberNotificationEmailDeliveryRecord>,
  options: {
    expectedLeaseOwner?: string;
    /** When set with expectedLeaseOwner, rejects stale workers after lease steal. */
    requireClaimedStatus?: boolean;
  } = {},
): Promise<MemberNotificationEmailDeliveryRecord | null> {
  const nowIso = new Date().toISOString();
  const requireClaimed =
    options.requireClaimedStatus !== false && Boolean(options.expectedLeaseOwner);

  if (shouldUseMemory()) {
    const index = memoryDeliveries.findIndex((row) => row.deliveryId === deliveryId);
    if (index < 0) {
      return null;
    }
    const current = memoryDeliveries[index]!;
    if (
      options.expectedLeaseOwner &&
      current.leaseOwner !== options.expectedLeaseOwner
    ) {
      return null;
    }
    if (requireClaimed && current.status !== "claimed") {
      return null;
    }
    const updated = {
      ...current,
      ...patch,
      updatedAt: nowIso,
    };
    memoryDeliveries[index] = updated;
    return structuredClone(updated);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const filter: Record<string, unknown> = { deliveryId };
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
  return result ? stripDelivery(result) : null;
}

/**
 * HU-NOTIF-02C.4 — page of open digest child intents for one bucket.
 * Callers must paginate until empty so completion never silently drops children.
 */
export async function listOpenMemberNotificationEmailDigestBucketDeliveriesPage(input: {
  digestBucketKey: string;
  activationAt: string;
  limit: number;
  afterCreatedAt?: string | null;
  afterDeliveryId?: string | null;
}): Promise<MemberNotificationEmailDeliveryRecord[]> {
  const openStatuses = new Set(["pending", "failed"]);

  if (shouldUseMemory()) {
    const afterCreatedAt = input.afterCreatedAt ?? null;
    const afterDeliveryId = input.afterDeliveryId ?? null;
    return memoryDeliveries
      .filter((row) => {
        if (row.digestBucketKey !== input.digestBucketKey) {
          return false;
        }
        if (row.createdAt < input.activationAt) {
          return false;
        }
        if (row.channel !== "digest_daily" && row.channel !== "digest_weekly") {
          return false;
        }
        if (!openStatuses.has(row.status) || row.attemptCount >= row.maxAttempts) {
          return false;
        }
        if (afterCreatedAt) {
          if (row.createdAt < afterCreatedAt) {
            return false;
          }
          if (
            row.createdAt === afterCreatedAt &&
            afterDeliveryId &&
            row.deliveryId <= afterDeliveryId
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const created = a.createdAt.localeCompare(b.createdAt);
        return created !== 0 ? created : a.deliveryId.localeCompare(b.deliveryId);
      })
      .slice(0, input.limit)
      .map((row) => structuredClone(row));
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const filter: Record<string, unknown> = {
    digestBucketKey: input.digestBucketKey,
    createdAt: { $gte: input.activationAt },
    channel: { $in: ["digest_daily", "digest_weekly"] },
    status: { $in: ["pending", "failed"] },
    attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
  };
  if (input.afterCreatedAt) {
    filter.$or = [
      { createdAt: { $gt: input.afterCreatedAt } },
      {
        createdAt: input.afterCreatedAt,
        deliveryId: { $gt: input.afterDeliveryId ?? "" },
      },
    ];
  }
  const documents = await collection
    .find(filter as never)
    .sort({ createdAt: 1, deliveryId: 1 })
    .limit(input.limit)
    .toArray();
  return documents.map(stripDelivery);
}

export interface MemberNotificationEmailDigestBucketDiscoveryRow {
  digestBucketKey: string;
  channel: "digest_daily" | "digest_weekly";
  recipientUserId: string;
  recipientMemberId: string | null;
  oldestCreatedAt: string;
}

/**
 * HU-NOTIF-02C.4 — discover distinct CLOSED digest buckets with open children.
 * Filters by digestPeriodEndsAt <= nowIso so open periods cannot starve the scan.
 * Bounded by distinct bucket limit (not raw row count).
 */
export async function listDueMemberNotificationEmailDigestBuckets(input: {
  activationAt: string;
  nowIso: string;
  limit: number;
}): Promise<MemberNotificationEmailDigestBucketDiscoveryRow[]> {
  if (shouldUseMemory()) {
    const grouped = new Map<string, MemberNotificationEmailDigestBucketDiscoveryRow>();
    for (const row of memoryDeliveries) {
      if (row.createdAt < input.activationAt) {
        continue;
      }
      if (row.channel !== "digest_daily" && row.channel !== "digest_weekly") {
        continue;
      }
      if (row.status !== "pending" && row.status !== "failed") {
        continue;
      }
      if (!row.digestBucketKey || row.attemptCount >= row.maxAttempts) {
        continue;
      }
      const endsAt = row.digestPeriodEndsAt;
      if (!endsAt || endsAt > input.nowIso) {
        continue;
      }
      const existing = grouped.get(row.digestBucketKey);
      if (!existing || row.createdAt < existing.oldestCreatedAt) {
        grouped.set(row.digestBucketKey, {
          digestBucketKey: row.digestBucketKey,
          channel: row.channel,
          recipientUserId: row.recipientUserId,
          recipientMemberId: row.recipientMemberId,
          oldestCreatedAt: row.createdAt,
        });
      }
    }
    return [...grouped.values()]
      .sort((a, b) => a.oldestCreatedAt.localeCompare(b.oldestCreatedAt))
      .slice(0, input.limit);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const rows = await collection
    .aggregate<{
      _id: string;
      channel: "digest_daily" | "digest_weekly";
      recipientUserId: string;
      recipientMemberId: string | null;
      oldestCreatedAt: string;
    }>([
      {
        $match: {
          createdAt: { $gte: input.activationAt },
          channel: { $in: ["digest_daily", "digest_weekly"] },
          status: { $in: ["pending", "failed"] },
          digestBucketKey: { $exists: true, $ne: null },
          digestPeriodEndsAt: { $exists: true, $ne: null, $lte: input.nowIso },
          attemptCount: { $lt: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS },
        },
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$digestBucketKey",
          channel: { $first: "$channel" },
          recipientUserId: { $first: "$recipientUserId" },
          recipientMemberId: { $first: "$recipientMemberId" },
          oldestCreatedAt: { $first: "$createdAt" },
        },
      },
      { $sort: { oldestCreatedAt: 1 } },
      { $limit: input.limit },
    ])
    .toArray();

  return rows
    .filter((row) => typeof row._id === "string" && row._id.length > 0)
    .map((row) => ({
      digestBucketKey: row._id,
      channel: row.channel,
      recipientUserId: row.recipientUserId,
      recipientMemberId: row.recipientMemberId,
      oldestCreatedAt: row.oldestCreatedAt,
    }));
}

export async function requeueDryRunOkMemberNotificationEmailDeliveries(input: {
  limit: number;
  activationAt?: string | null;
}): Promise<number> {
  const nowIso = new Date().toISOString();
  const activationAt = input.activationAt ?? null;

  if (shouldUseMemory()) {
    let count = 0;
    for (const row of memoryDeliveries) {
      if (count >= input.limit) {
        break;
      }
      if (row.status !== "dry_run_ok" || row.channel !== "immediate") {
        continue;
      }
      if (activationAt && row.createdAt < activationAt) {
        continue;
      }
      Object.assign(row, {
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: nowIso,
        leaseOwner: null,
        leaseExpiresAt: null,
        skipReason: null,
        lastErrorCode: null,
        providerEmailId: null,
        updatedAt: nowIso,
      });
      count += 1;
    }
    return count;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const query: Record<string, unknown> = {
    status: "dry_run_ok",
    channel: "immediate",
  };
  if (activationAt) {
    query.createdAt = { $gte: activationAt };
  }
  const due = await collection.find(query).limit(input.limit).toArray();
  let count = 0;
  for (const row of due) {
    const result = await collection.updateOne(
      { deliveryId: row.deliveryId, status: "dry_run_ok" },
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
          updatedAt: nowIso,
        },
      },
    );
    count += result.modifiedCount;
  }
  return count;
}
