/**
 * HU-NOTIF-02C.5 — conservative multi-instance send budgets.
 *
 * Production / deployed platforms: Mongo-only. Fail closed if storage or the
 * required TTL index is unavailable. No memory-only fallback that could bypass
 * global limits across API instances.
 *
 * Tests may force an in-memory counter store explicitly.
 */

import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { isDeployedPlatformRequiringRealEmail } from "../../email/email-safety-guards.js";

/** Controlled-phase defaults — intentionally low. */
export const MEMBER_NOTIFICATION_EMAIL_GLOBAL_HOURLY_LIMIT = 30;
export const MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT = 5;

export const MEMBER_NOTIFICATION_EMAIL_SEND_RATE_LIMIT_INDEX_NAMES = {
  ttl: "member_notification_email_send_rate_limits_ttl",
} as const;

export const MEMBER_NOTIFICATION_EMAIL_SEND_RATE_LIMIT_INDEXES: IndexDescription[] = [
  {
    key: { expiresAt: 1 },
    expireAfterSeconds: 0,
    name: MEMBER_NOTIFICATION_EMAIL_SEND_RATE_LIMIT_INDEX_NAMES.ttl,
  },
];

interface RateLimitDocument {
  _id: string;
  kind: "global_hourly" | "recipient_daily";
  count: number;
  createdAt: string;
  expiresAt: Date;
}

const memoryCounters = new Map<string, RateLimitDocument>();
let forceMemoryForTests = false;
let indexesReadyOverrideForTests: boolean | null = null;
let cachedIndexesReady = false;

export function setMemberNotificationEmailSendRateLimitForceMemoryForTests(
  enabled: boolean,
): void {
  forceMemoryForTests = enabled;
}

export function resetMemberNotificationEmailSendRateLimitStoreForTests(): void {
  memoryCounters.clear();
  cachedIndexesReady = false;
}

export function setMemberNotificationEmailSendRateLimitIndexesReadyForTests(
  ready: boolean | null,
): void {
  indexesReadyOverrideForTests = ready;
  if (ready !== true) {
    cachedIndexesReady = false;
  }
}

/**
 * True only for explicit unit-test memory mode.
 * Deployed platforms never use memory counters.
 */
function allowMemoryRateLimitStore(): boolean {
  if (forceMemoryForTests) {
    return true;
  }
  // Never fall back to memory on staging/beta/production — that would break
  // cross-instance global budgets.
  if (isDeployedPlatformRequiringRealEmail()) {
    return false;
  }
  return false;
}

async function ensureMongoReady(): Promise<boolean> {
  if (!isMongoConfigured()) {
    return false;
  }
  try {
    await connectMongoClient();
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify TTL index exists (create if missing). Fail closed when unavailable.
 */
export async function assertMemberNotificationEmailSendRateLimitIndexesReady(): Promise<boolean> {
  if (indexesReadyOverrideForTests === false) {
    return false;
  }
  if (indexesReadyOverrideForTests === true || cachedIndexesReady) {
    return true;
  }
  if (allowMemoryRateLimitStore()) {
    cachedIndexesReady = true;
    return true;
  }

  const mongoReady = await ensureMongoReady();
  if (!mongoReady) {
    return false;
  }

  const collection = getMongoCollection(
    MONGO_COLLECTIONS.memberNotificationEmailSendRateLimits,
  );

  for (const index of MEMBER_NOTIFICATION_EMAIL_SEND_RATE_LIMIT_INDEXES) {
    try {
      await collection.createIndex(index.key, {
        unique: index.unique,
        expireAfterSeconds: index.expireAfterSeconds,
        name: index.name,
      });
    } catch (error) {
      const mongoError = error as { code?: number };
      // IndexOptionsConflict / IndexKeySpecsConflict — still verify by listing.
      if (mongoError.code !== 85 && mongoError.code !== 86) {
        return false;
      }
    }
  }

  let indexes: Array<{ name?: string; expireAfterSeconds?: number }>;
  try {
    indexes = await collection.indexes();
  } catch {
    return false;
  }

  const ttl = indexes.find(
    (entry) => entry.name === MEMBER_NOTIFICATION_EMAIL_SEND_RATE_LIMIT_INDEX_NAMES.ttl,
  );
  if (!ttl || ttl.expireAfterSeconds !== 0) {
    return false;
  }

  cachedIndexesReady = true;
  return true;
}

function hourBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function dayBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function hourExpiry(nowMs: number): Date {
  const date = new Date(nowMs);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours() + 1,
    ),
  );
}

function dayExpiry(nowMs: number): Date {
  const date = new Date(nowMs);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

async function consumeCounter(input: {
  id: string;
  kind: RateLimitDocument["kind"];
  max: number;
  expiresAt: Date;
}): Promise<"allowed" | "limited" | "unavailable"> {
  const nowIso = new Date().toISOString();

  if (allowMemoryRateLimitStore()) {
    const existing = memoryCounters.get(input.id);
    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      memoryCounters.set(input.id, {
        _id: input.id,
        kind: input.kind,
        count: 1,
        createdAt: nowIso,
        expiresAt: input.expiresAt,
      });
      return "allowed";
    }
    if (existing.count >= input.max) {
      return "limited";
    }
    existing.count += 1;
    return "allowed";
  }

  const mongoReady = await ensureMongoReady();
  if (!mongoReady) {
    return "unavailable";
  }

  const indexesReady = await assertMemberNotificationEmailSendRateLimitIndexesReady();
  if (!indexesReady) {
    return "unavailable";
  }

  const collection = getMongoCollection<RateLimitDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailSendRateLimits,
  );

  try {
    const result = await collection.findOneAndUpdate(
      {
        _id: input.id,
        count: { $lt: input.max },
      },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          kind: input.kind,
          createdAt: nowIso,
          expiresAt: input.expiresAt,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    return result !== null ? "allowed" : "limited";
  } catch (error) {
    const code = (error as { code?: number }).code;
    // Duplicate key on upsert race when count already at max — treat as limited.
    if (code === 11000) {
      return "limited";
    }
    return "unavailable";
  }
}

export type MemberNotificationEmailSendBudgetResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "global" | "recipient" | "storage_unavailable" | "index_not_ready";
    };

/**
 * Consume global + per-recipient budgets.
 * Fail closed when Mongo/TTL readiness is unavailable (no production memory bypass).
 */
export async function consumeMemberNotificationEmailSendBudget(input: {
  recipientMemberId: string;
  nowMs?: number;
}): Promise<MemberNotificationEmailSendBudgetResult> {
  if (!allowMemoryRateLimitStore()) {
    // Explicit readiness failure (e.g. missing TTL) must fail closed before any send.
    if (indexesReadyOverrideForTests === false) {
      return { allowed: false, reason: "index_not_ready" };
    }
    if (!isMongoConfigured()) {
      return { allowed: false, reason: "storage_unavailable" };
    }
    const indexesReady = await assertMemberNotificationEmailSendRateLimitIndexesReady();
    if (!indexesReady) {
      return { allowed: false, reason: "index_not_ready" };
    }
  }

  const nowMs = input.nowMs ?? Date.now();
  const globalId = `global:${hourBucket(nowMs)}`;
  const recipientId = `recipient:${input.recipientMemberId}:${dayBucket(nowMs)}`;

  const globalResult = await consumeCounter({
    id: globalId,
    kind: "global_hourly",
    max: MEMBER_NOTIFICATION_EMAIL_GLOBAL_HOURLY_LIMIT,
    expiresAt: hourExpiry(nowMs),
  });
  if (globalResult === "unavailable") {
    return { allowed: false, reason: "storage_unavailable" };
  }
  if (globalResult === "limited") {
    return { allowed: false, reason: "global" };
  }

  const recipientResult = await consumeCounter({
    id: recipientId,
    kind: "recipient_daily",
    max: MEMBER_NOTIFICATION_EMAIL_PER_RECIPIENT_DAILY_LIMIT,
    expiresAt: dayExpiry(nowMs),
  });
  if (recipientResult === "unavailable") {
    return { allowed: false, reason: "storage_unavailable" };
  }
  if (recipientResult === "limited") {
    return { allowed: false, reason: "recipient" };
  }

  return { allowed: true };
}
