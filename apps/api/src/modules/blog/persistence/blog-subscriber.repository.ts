/**
 * Pack 21A — Blog subscriber persistence (Mongo + memory test seam).
 */
import type {
  BlogSubscriberRecord,
  BlogSubscriptionStatus,
  BlogSubscriptionType,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError, BlogPersistenceUnavailableError } from "../blog.errors.js";

export interface BlogSubscriberMongoDocument extends BlogSubscriberRecord {
  _id?: string;
}

const memorySubscribers: BlogSubscriberRecord[] = [];

/** Pack 21F — in-process Welcome send claims (memory store + double-submit guard). */
const memoryWelcomeSendClaims = new Set<string>();

function isBlogSubscriberMemoryStore(): boolean {
  return process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true" || !isMongoConfigured();
}

async function ensureReady(): Promise<void> {
  if (isBlogSubscriberMemoryStore()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<BlogSubscriberMongoDocument>(MONGO_COLLECTIONS.blogSubscribers);
}

function stripId(doc: BlogSubscriberMongoDocument): BlogSubscriberRecord {
  const {
    _id: _ignored,
    welcomeSendClaimedAt: _claim,
    ...record
  } = doc as BlogSubscriberMongoDocument & { welcomeSendClaimedAt?: string };
  return record;
}

export function resetBlogSubscribersForTests(): void {
  memorySubscribers.length = 0;
  memoryWelcomeSendClaims.clear();
}

export async function findBlogSubscriberByNormalizedEmail(
  emailNormalized: string,
  subscriptionType: BlogSubscriptionType = "blog_publications",
): Promise<BlogSubscriberRecord | null> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    return (
      memorySubscribers.find(
        (row) =>
          row.emailNormalized === emailNormalized && row.subscriptionType === subscriptionType,
      ) ?? null
    );
  }
  try {
    const doc = await collection().findOne({ emailNormalized, subscriptionType });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog subscriber.", error);
  }
}

export async function findBlogSubscriberById(
  subscriberId: string,
): Promise<BlogSubscriberRecord | null> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    return memorySubscribers.find((row) => row.subscriberId === subscriberId) ?? null;
  }
  try {
    const doc = await collection().findOne({ subscriberId });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog subscriber by id.", error);
  }
}

export async function findBlogSubscriberByConfirmTokenHash(
  confirmTokenHash: string,
): Promise<BlogSubscriberRecord | null> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    return memorySubscribers.find((row) => row.confirmTokenHash === confirmTokenHash) ?? null;
  }
  try {
    const doc = await collection().findOne({ confirmTokenHash });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog subscriber by confirm token.", error);
  }
}

export async function findBlogSubscriberByUnsubscribeTokenHash(
  unsubscribeTokenHash: string,
): Promise<BlogSubscriberRecord | null> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    return (
      memorySubscribers.find((row) => row.unsubscribeTokenHash === unsubscribeTokenHash) ?? null
    );
  }
  try {
    const doc = await collection().findOne({ unsubscribeTokenHash });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog subscriber by unsubscribe token.", error);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compareNewestCreatedFirst(a: BlogSubscriberRecord, b: BlogSubscriberRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export interface ListBlogSubscribersForAdminQuery {
  subscriptionType?: BlogSubscriptionType;
  status?: BlogSubscriptionStatus | "all";
  emailQuery?: string;
  limit: number;
  offset: number;
}

/** Pack 21C — Admin directory listing (bounded, deterministic sort). */
export async function listBlogSubscribersForAdmin(
  query: ListBlogSubscribersForAdminQuery,
): Promise<{ items: BlogSubscriberRecord[]; total: number }> {
  await ensureReady();
  const subscriptionType = query.subscriptionType ?? "blog_publications";
  const status = query.status ?? "all";
  const emailQuery = query.emailQuery?.trim().toLowerCase() ?? "";
  const limit = Math.min(Math.max(query.limit, 1), 500);
  const offset = Math.max(query.offset, 0);

  if (isBlogSubscriberMemoryStore()) {
    let rows = memorySubscribers.filter((row) => row.subscriptionType === subscriptionType);
    if (status !== "all") {
      rows = rows.filter((row) => row.status === status);
    }
    if (emailQuery) {
      rows = rows.filter(
        (row) =>
          row.emailNormalized.includes(emailQuery) ||
          row.emailDisplay.toLowerCase().includes(emailQuery) ||
          (row.displayName?.toLowerCase().includes(emailQuery) ?? false),
      );
    }
    rows = [...rows].sort(compareNewestCreatedFirst);
    return {
      total: rows.length,
      items: rows.slice(offset, offset + limit),
    };
  }

  try {
    const filter: Record<string, unknown> = { subscriptionType };
    if (status !== "all") {
      filter.status = status;
    }
    if (emailQuery) {
      const pattern = escapeRegex(emailQuery);
      filter.$or = [
        { emailNormalized: { $regex: pattern, $options: "i" } },
        { emailDisplay: { $regex: pattern, $options: "i" } },
        { displayName: { $regex: pattern, $options: "i" } },
      ];
    }
    const [total, documents] = await Promise.all([
      collection().countDocuments(filter),
      collection()
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);
    return {
      total,
      items: documents.map(stripId),
    };
  } catch (error) {
    throw new BlogPersistenceError("Failed to list Blog subscribers.", error);
  }
}

export async function countBlogSubscribersByStatus(input: {
  subscriptionType?: BlogSubscriptionType;
}): Promise<{
  subscribed: number;
  not_confirmed: number;
  unsubscribed: number;
  total: number;
}> {
  await ensureReady();
  const subscriptionType = input.subscriptionType ?? "blog_publications";

  if (isBlogSubscriberMemoryStore()) {
    const rows = memorySubscribers.filter((row) => row.subscriptionType === subscriptionType);
    const subscribed = rows.filter((row) => row.status === "subscribed").length;
    const not_confirmed = rows.filter((row) => row.status === "not_confirmed").length;
    const unsubscribed = rows.filter((row) => row.status === "unsubscribed").length;
    return {
      subscribed,
      not_confirmed,
      unsubscribed,
      total: rows.length,
    };
  }

  try {
    const [subscribed, not_confirmed, unsubscribed] = await Promise.all([
      collection().countDocuments({ subscriptionType, status: "subscribed" }),
      collection().countDocuments({ subscriptionType, status: "not_confirmed" }),
      collection().countDocuments({ subscriptionType, status: "unsubscribed" }),
    ]);
    return {
      subscribed,
      not_confirmed,
      unsubscribed,
      total: subscribed + not_confirmed + unsubscribed,
    };
  } catch (error) {
    throw new BlogPersistenceError("Failed to count Blog subscribers.", error);
  }
}

/**
 * Pack 21D — cursor batch of eligible subscribed recipients (deterministic subscriberId order).
 */
export async function listEligibleBlogPublicationSubscribersBatch(input: {
  afterSubscriberId?: string;
  limit: number;
}): Promise<BlogSubscriberRecord[]> {
  await ensureReady();
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const after = input.afterSubscriberId?.trim() || undefined;

  if (isBlogSubscriberMemoryStore()) {
    let rows = memorySubscribers.filter(
      (row) =>
        row.subscriptionType === "blog_publications" && row.status === "subscribed",
    );
    rows = [...rows].sort((a, b) => a.subscriberId.localeCompare(b.subscriberId));
    if (after) {
      rows = rows.filter((row) => row.subscriberId > after);
    }
    return rows.slice(0, limit);
  }

  try {
    const filter: Record<string, unknown> = {
      subscriptionType: "blog_publications",
      status: "subscribed",
    };
    if (after) {
      filter.subscriberId = { $gt: after };
    }
    const documents = await collection()
      .find(filter)
      .sort({ subscriberId: 1 })
      .limit(limit)
      .toArray();
    return documents.map(stripId);
  } catch (error) {
    throw new BlogPersistenceError("Failed to list eligible Blog publication subscribers.", error);
  }
}

export async function upsertBlogSubscriberRecord(
  record: BlogSubscriberRecord,
): Promise<BlogSubscriberRecord> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    const index = memorySubscribers.findIndex((row) => row.subscriberId === record.subscriberId);
    if (index >= 0) {
      memorySubscribers[index] = record;
    } else {
      memorySubscribers.push(record);
    }
    return record;
  }
  try {
    await collection().replaceOne({ subscriberId: record.subscriberId }, record, { upsert: true });
    return record;
  } catch (error) {
    if (!isMongoConfigured()) {
      throw new BlogPersistenceUnavailableError();
    }
    throw new BlogPersistenceError("Failed to upsert Blog subscriber.", error);
  }
}

/**
 * Pack 21F — atomic Welcome-send claim so concurrent confirmations cannot
 * double-send or double-increment emailsSent.
 *
 * Mongo uses welcomeSendClaimedAt (internal field, not part of public DTO).
 * Memory uses an in-process claim set.
 */
export async function claimBlogSubscriberWelcomeSend(subscriberId: string): Promise<boolean> {
  await ensureReady();
  const now = new Date().toISOString();

  if (isBlogSubscriberMemoryStore()) {
    if (memoryWelcomeSendClaims.has(subscriberId)) {
      return false;
    }
    const row = memorySubscribers.find((entry) => entry.subscriberId === subscriberId);
    if (!row || row.status !== "subscribed" || row.welcomeSentAt) {
      return false;
    }
    memoryWelcomeSendClaims.add(subscriberId);
    return true;
  }

  try {
    const result = await collection().findOneAndUpdate(
      {
        subscriberId,
        status: "subscribed",
        welcomeSentAt: { $exists: false },
        welcomeSendClaimedAt: { $exists: false },
      },
      {
        $set: {
          welcomeSendClaimedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return Boolean(result);
  } catch (error) {
    throw new BlogPersistenceError("Failed to claim Blog Welcome send.", error);
  }
}

export async function releaseBlogSubscriberWelcomeSendClaim(subscriberId: string): Promise<void> {
  await ensureReady();
  if (isBlogSubscriberMemoryStore()) {
    memoryWelcomeSendClaims.delete(subscriberId);
    return;
  }
  try {
    await collection().updateOne(
      { subscriberId },
      {
        $unset: { welcomeSendClaimedAt: "" },
        $set: { updatedAt: new Date().toISOString() },
      },
    );
  } catch (error) {
    throw new BlogPersistenceError("Failed to release Blog Welcome send claim.", error);
  }
}

/** Persist rotated unsubscribe token without wiping Welcome claim fields. */
export async function setBlogSubscriberUnsubscribeTokenHash(input: {
  subscriberId: string;
  unsubscribeTokenHash: string;
}): Promise<void> {
  await ensureReady();
  const now = new Date().toISOString();
  if (isBlogSubscriberMemoryStore()) {
    const index = memorySubscribers.findIndex((row) => row.subscriberId === input.subscriberId);
    if (index < 0) {
      return;
    }
    memorySubscribers[index] = {
      ...memorySubscribers[index]!,
      unsubscribeTokenHash: input.unsubscribeTokenHash,
      updatedAt: now,
    };
    return;
  }
  try {
    await collection().updateOne(
      { subscriberId: input.subscriberId },
      {
        $set: {
          unsubscribeTokenHash: input.unsubscribeTokenHash,
          updatedAt: now,
        },
      },
    );
  } catch (error) {
    throw new BlogPersistenceError("Failed to rotate Blog unsubscribe token.", error);
  }
}

/**
 * Mark Welcome sent + increment emailsSent once. Clears the send claim.
 * No-ops if welcomeSentAt is already set (idempotent under races).
 */
export async function completeBlogSubscriberWelcomeSend(subscriberId: string): Promise<boolean> {
  await ensureReady();
  const now = new Date().toISOString();

  if (isBlogSubscriberMemoryStore()) {
    const index = memorySubscribers.findIndex((row) => row.subscriberId === subscriberId);
    memoryWelcomeSendClaims.delete(subscriberId);
    if (index < 0) {
      return false;
    }
    const row = memorySubscribers[index]!;
    if (row.welcomeSentAt) {
      return false;
    }
    memorySubscribers[index] = {
      ...row,
      welcomeSentAt: now,
      emailsSent: row.emailsSent + 1,
      updatedAt: now,
    };
    return true;
  }

  try {
    const result = await collection().findOneAndUpdate(
      {
        subscriberId,
        welcomeSentAt: { $exists: false },
      },
      {
        $set: {
          welcomeSentAt: now,
          updatedAt: now,
        },
        $inc: { emailsSent: 1 },
        $unset: { welcomeSendClaimedAt: "" },
      },
      { returnDocument: "after" },
    );
    return Boolean(result);
  } catch (error) {
    throw new BlogPersistenceError("Failed to complete Blog Welcome send.", error);
  }
}

export async function deleteBlogSubscribersByEmailPrefixForTests(
  prefix: string,
): Promise<number> {
  if (isBlogSubscriberMemoryStore()) {
    const before = memorySubscribers.length;
    for (let i = memorySubscribers.length - 1; i >= 0; i -= 1) {
      if (memorySubscribers[i]!.emailNormalized.startsWith(prefix.toLowerCase())) {
        memorySubscribers.splice(i, 1);
      }
    }
    return before - memorySubscribers.length;
  }
  await ensureReady();
  const result = await collection().deleteMany({
    emailNormalized: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });
  return result.deletedCount;
}
