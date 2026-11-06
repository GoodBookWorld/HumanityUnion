/**
 * RSS-SOURCE-02B — cross-instance lease for the public news refresh. One document
 * (fixed `_id`) holds the current holder and expiry; `_id` uniqueness makes the
 * conditional upsert atomic without relying on a secondary index.
 *
 * The holder renews the lease while it works and must `confirm()` ownership before
 * writing, so a refresh that outlives its lease never writes over a newer holder.
 */

import { randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

import { resolvePublicNewsPersistenceMode } from "./public-news.repository.js";

/** Lease lifetime; renewed every third of it while the holder is working. */
export const PUBLIC_NEWS_REFRESH_LEASE_TTL_MS = 30 * 60_000;
/** A holder stops renewing (and loses the right to write) after this long. */
export const PUBLIC_NEWS_REFRESH_LEASE_MAX_HOLD_MS = 2 * 60 * 60_000;

const LEASE_ID = "public-news-refresh";

interface RefreshLeaseDocument {
  _id: string;
  holderId: string | null;
  acquiredAt: string | null;
  expiresAt: string;
  lastCompletedAt?: string | null;
}

export interface PublicNewsRefreshLease {
  holderId: string;
  /**
   * Re-checks ownership and extends the lease. False when another holder took it,
   * it expired, the maximum hold time passed, or storage failed (fail closed).
   */
  confirm(now?: Date): Promise<boolean>;
  /** `completed` records a finished refresh so deferred follow-ups can skip. */
  release(input: { completed: boolean; now?: Date }): Promise<void>;
}

export type PublicNewsRefreshLeaseResult =
  | { acquired: true; lease: PublicNewsRefreshLease }
  | { acquired: false; reason: "held"; retryAt: number }
  | { acquired: false; reason: "completed_since" };

export interface PublicNewsRefreshLeaseOptions {
  now?: Date;
  ttlMs?: number;
  maxHoldMs?: number;
  /** Heartbeat period; 0 disables the timer (tests drive `confirm` directly). */
  renewEveryMs?: number;
  skipIfCompletedSince?: Date;
  holderId?: string;
}

let memoryLease: RefreshLeaseDocument | null = null;
let failureForTests: Error | null = null;

export function resetPublicNewsRefreshLeaseForTests(): void {
  memoryLease = null;
  failureForTests = null;
}

/** Tests only: every lease storage operation rejects with this error. */
export function setPublicNewsRefreshLeaseFailureForTests(error: Error | null): void {
  failureForTests = error;
}

function getCollection() {
  return getMongoCollection<RefreshLeaseDocument>(MONGO_COLLECTIONS.publicNewsRefreshLease);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function assertStorageAvailable(): void {
  if (failureForTests) {
    throw failureForTests;
  }
}

function completedSince(document: RefreshLeaseDocument | null, sinceIso: string | null): boolean {
  return Boolean(sinceIso && document?.lastCompletedAt && document.lastCompletedAt >= sinceIso);
}

function heldResult(document: RefreshLeaseDocument | null, nowMs: number, ttlMs: number) {
  const expiresAt = document ? Date.parse(document.expiresAt) : Number.NaN;
  return {
    acquired: false as const,
    reason: "held" as const,
    retryAt: Number.isNaN(expiresAt) ? nowMs + ttlMs : expiresAt,
  };
}

/** Extends the lease only for its current, unexpired holder. */
async function renewLease(holderId: string, now: Date, ttlMs: number): Promise<boolean> {
  assertStorageAvailable();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  if (resolvePublicNewsPersistenceMode() === "memory") {
    if (memoryLease?.holderId !== holderId || memoryLease.expiresAt <= nowIso) {
      return false;
    }
    memoryLease = { ...memoryLease, expiresAt };
    return true;
  }

  const result = await getCollection().updateOne(
    { _id: LEASE_ID, holderId, expiresAt: { $gt: nowIso } },
    { $set: { expiresAt } },
  );
  return result.matchedCount === 1;
}

async function releaseLease(
  holderId: string,
  input: { completed: boolean; now?: Date },
): Promise<void> {
  assertStorageAvailable();
  const nowIso = (input.now ?? new Date()).toISOString();
  const update = {
    holderId: null,
    acquiredAt: null,
    expiresAt: nowIso,
    ...(input.completed ? { lastCompletedAt: nowIso } : {}),
  };

  if (resolvePublicNewsPersistenceMode() === "memory") {
    if (memoryLease?.holderId === holderId) {
      memoryLease = { ...memoryLease, ...update };
    }
    return;
  }

  await getCollection().updateOne({ _id: LEASE_ID, holderId }, { $set: update });
}

function createLeaseHandle(
  holderId: string,
  acquiredAtMs: number,
  options: { ttlMs: number; maxHoldMs: number; renewEveryMs: number },
): PublicNewsRefreshLease {
  let released = false;
  let heartbeat: NodeJS.Timeout | null = null;

  const confirm = async (now: Date = new Date()): Promise<boolean> => {
    if (released || now.getTime() - acquiredAtMs > options.maxHoldMs) {
      return false;
    }
    try {
      return await renewLease(holderId, now, options.ttlMs);
    } catch {
      return false;
    }
  };

  if (options.renewEveryMs > 0) {
    heartbeat = setInterval(() => {
      void confirm().then((held) => {
        if (!held && heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      });
    }, options.renewEveryMs);
    heartbeat.unref?.();
  }

  return {
    holderId,
    confirm,
    release: async (input) => {
      released = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      await releaseLease(holderId, input);
    },
  };
}

/**
 * Acquires the lease when it is free or expired. With `skipIfCompletedSince`, also
 * refuses when another holder completed a refresh at or after that time. Storage
 * errors propagate: callers must treat them as "not acquired".
 */
export async function tryAcquirePublicNewsRefreshLease(
  input: PublicNewsRefreshLeaseOptions = {},
): Promise<PublicNewsRefreshLeaseResult> {
  assertStorageAvailable();
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const ttlMs = input.ttlMs ?? PUBLIC_NEWS_REFRESH_LEASE_TTL_MS;
  const maxHoldMs = input.maxHoldMs ?? PUBLIC_NEWS_REFRESH_LEASE_MAX_HOLD_MS;
  const renewEveryMs = input.renewEveryMs ?? Math.floor(ttlMs / 3);
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const sinceIso = input.skipIfCompletedSince?.toISOString() ?? null;
  const holderId = input.holderId ?? `${process.pid}-${randomUUID()}`;
  const handle = () =>
    createLeaseHandle(holderId, now.getTime(), { ttlMs, maxHoldMs, renewEveryMs });

  if (resolvePublicNewsPersistenceMode() === "memory") {
    if (completedSince(memoryLease, sinceIso)) {
      return { acquired: false, reason: "completed_since" };
    }
    if (memoryLease && memoryLease.expiresAt > nowIso) {
      return heldResult(memoryLease, now.getTime(), ttlMs);
    }
    memoryLease = {
      _id: LEASE_ID,
      holderId,
      acquiredAt: nowIso,
      expiresAt,
      lastCompletedAt: memoryLease?.lastCompletedAt ?? null,
    };
    return { acquired: true, lease: handle() };
  }

  const collection = getCollection();
  try {
    const updated = await collection.findOneAndUpdate(
      {
        _id: LEASE_ID,
        expiresAt: { $lte: nowIso },
        ...(sinceIso
          ? { $or: [{ lastCompletedAt: null }, { lastCompletedAt: { $lt: sinceIso } }] }
          : {}),
      },
      { $set: { holderId, acquiredAt: nowIso, expiresAt } },
      { upsert: true, returnDocument: "after" },
    );
    if (updated?.holderId === holderId) {
      return { acquired: true, lease: handle() };
    }
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const current = await collection.findOne({ _id: LEASE_ID });
  if (completedSince(current, sinceIso)) {
    return { acquired: false, reason: "completed_since" };
  }
  return heldResult(current, now.getTime(), ttlMs);
}
