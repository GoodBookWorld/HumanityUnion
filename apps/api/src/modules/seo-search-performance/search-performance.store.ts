/**
 * SEO-12B.1 — persistence for search performance metrics and provider sync state.
 *
 * `seo_search_daily_metrics`: one document per provider, site and day (16-month TTL).
 * `seo_search_sync_state`: one document per provider, including the sync lease.
 * Sync results are written only while the writer still holds the lease.
 */
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type {
  SearchDailyMetricRecord,
  SearchProvider,
  SearchProviderSnapshot,
  SearchSyncError,
  SearchSyncLease,
  SearchSyncStateRecord,
} from "./search-performance.types.js";

export interface RecordSyncSuccessInput {
  readonly siteUrl: string;
  readonly at: Date;
  readonly runId: string;
  readonly lastDataDay: string | null;
  readonly snapshot: SearchProviderSnapshot;
}

export interface RecordSyncFailureInput {
  readonly siteUrl: string;
  readonly at: Date;
  readonly runId: string;
  readonly error: Omit<SearchSyncError, "at">;
}

export interface SearchPerformanceStore {
  upsertDailyMetrics(rows: readonly SearchDailyMetricRecord[]): Promise<number>;
  listDailyMetrics(query: {
    provider: SearchProvider;
    siteUrl: string;
    fromDay: string;
    toDay: string;
  }): Promise<SearchDailyMetricRecord[]>;
  getSyncState(provider: SearchProvider): Promise<SearchSyncStateRecord | null>;
  /** Atomically takes the provider lease when it is free or expired. */
  acquireLease(
    provider: SearchProvider,
    holder: string,
    now: Date,
    ttlMs: number,
  ): Promise<boolean>;
  releaseLease(provider: SearchProvider, holder: string): Promise<void>;
  /** Returns false when the lease is no longer held by `holder` (nothing written). */
  recordSyncAttempt(provider: SearchProvider, holder: string, at: Date): Promise<boolean>;
  recordSyncSuccess(
    provider: SearchProvider,
    holder: string,
    input: RecordSyncSuccessInput,
  ): Promise<boolean>;
  recordSyncFailure(
    provider: SearchProvider,
    holder: string,
    input: RecordSyncFailureInput,
  ): Promise<boolean>;
  /** Drops query/page snapshots past their 90-day retention. */
  clearExpiredSnapshots(now: Date): Promise<number>;
}

function emptyState(provider: SearchProvider, now: Date): SearchSyncStateRecord {
  return {
    provider,
    siteUrl: null,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    consecutiveFailures: 0,
    lastDataDay: null,
    lastRunId: null,
    snapshot: null,
    lease: null,
    updatedAt: now.toISOString(),
  };
}

function leaseIsFree(lease: SearchSyncLease | null, now: Date): boolean {
  return !lease || lease.expiresAt.getTime() <= now.getTime();
}

/** In-process store for unit tests and environments without MongoDB. */
export function createMemorySearchPerformanceStore(): SearchPerformanceStore {
  const metrics = new Map<string, SearchDailyMetricRecord>();
  const states = new Map<SearchProvider, SearchSyncStateRecord>();

  function holds(provider: SearchProvider, holder: string): SearchSyncStateRecord | null {
    const state = states.get(provider);
    return state?.lease?.holder === holder ? state : null;
  }

  return {
    async upsertDailyMetrics(rows) {
      for (const row of rows) {
        metrics.set(`${row.provider}|${row.siteUrl}|${row.day}`, { ...row });
      }
      return rows.length;
    },
    async listDailyMetrics(query) {
      return [...metrics.values()]
        .filter(
          (row) =>
            row.provider === query.provider &&
            row.siteUrl === query.siteUrl &&
            row.day >= query.fromDay &&
            row.day <= query.toDay,
        )
        .sort((a, b) => (a.day < b.day ? -1 : 1));
    },
    async getSyncState(provider) {
      const state = states.get(provider);
      return state ? structuredClone(state) : null;
    },
    async acquireLease(provider, holder, now, ttlMs) {
      const state = states.get(provider) ?? emptyState(provider, now);
      if (!leaseIsFree(state.lease, now)) {
        return false;
      }
      states.set(provider, {
        ...state,
        lease: { holder, acquiredAt: now, expiresAt: new Date(now.getTime() + ttlMs) },
        updatedAt: now.toISOString(),
      });
      return true;
    },
    async releaseLease(provider, holder) {
      const state = holds(provider, holder);
      if (state) {
        states.set(provider, { ...state, lease: null });
      }
    },
    async recordSyncAttempt(provider, holder, at) {
      const state = holds(provider, holder);
      if (!state) {
        return false;
      }
      states.set(provider, {
        ...state,
        lastAttemptAt: at.toISOString(),
        updatedAt: at.toISOString(),
      });
      return true;
    },
    async recordSyncSuccess(provider, holder, input) {
      const state = holds(provider, holder);
      if (!state) {
        return false;
      }
      states.set(provider, {
        ...state,
        siteUrl: input.siteUrl,
        lastSuccessAt: input.at.toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        lastDataDay: input.lastDataDay ?? state.lastDataDay,
        lastRunId: input.runId,
        snapshot: structuredClone(input.snapshot),
        updatedAt: input.at.toISOString(),
      });
      return true;
    },
    async recordSyncFailure(provider, holder, input) {
      const state = holds(provider, holder);
      if (!state) {
        return false;
      }
      states.set(provider, {
        ...state,
        siteUrl: input.siteUrl,
        lastFailureAt: input.at.toISOString(),
        lastError: { ...input.error, at: input.at.toISOString() },
        consecutiveFailures: state.consecutiveFailures + 1,
        lastRunId: input.runId,
        updatedAt: input.at.toISOString(),
      });
      return true;
    },
    async clearExpiredSnapshots(now) {
      let cleared = 0;
      for (const [provider, state] of states) {
        if (state.snapshot && Date.parse(state.snapshot.expiresAt) <= now.getTime()) {
          states.set(provider, { ...state, snapshot: null });
          cleared += 1;
        }
      }
      return cleared;
    },
  };
}

type SyncStateDocument = SearchSyncStateRecord;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000
  );
}

export function createMongoSearchPerformanceStore(): SearchPerformanceStore {
  const metrics = () =>
    getMongoCollection<SearchDailyMetricRecord>(MONGO_COLLECTIONS.seoSearchDailyMetrics);
  const states = () => getMongoCollection<SyncStateDocument>(MONGO_COLLECTIONS.seoSearchSyncState);

  async function ready(): Promise<void> {
    await connectMongoClient();
  }

  async function updateIfHolder(
    provider: SearchProvider,
    holder: string,
    set: Record<string, unknown>,
    inc?: Record<string, number>,
  ): Promise<boolean> {
    await ready();
    const result = await states().updateOne(
      { provider, "lease.holder": holder },
      { $set: set, ...(inc ? { $inc: inc } : {}) },
    );
    return result.matchedCount === 1;
  }

  return {
    async upsertDailyMetrics(rows) {
      if (rows.length === 0) {
        return 0;
      }
      await ready();
      const result = await metrics().bulkWrite(
        rows.map((row) => ({
          updateOne: {
            filter: { provider: row.provider, siteUrl: row.siteUrl, day: row.day },
            update: { $set: { ...row } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      return result.upsertedCount + result.modifiedCount;
    },
    async listDailyMetrics(query) {
      await ready();
      const docs = await metrics()
        .find(
          {
            provider: query.provider,
            siteUrl: query.siteUrl,
            day: { $gte: query.fromDay, $lte: query.toDay },
          },
          { projection: { _id: 0 } },
        )
        .sort({ day: 1 })
        .limit(1000)
        .toArray();
      return docs as SearchDailyMetricRecord[];
    },
    async getSyncState(provider) {
      await ready();
      const doc = await states().findOne({ provider }, { projection: { _id: 0 } });
      return (doc as SearchSyncStateRecord | null) ?? null;
    },
    async acquireLease(provider, holder, now, ttlMs) {
      await ready();
      const {
        lease: _lease,
        provider: _provider,
        updatedAt: _updatedAt,
        ...defaults
      } = emptyState(provider, now);
      try {
        const result = await states().findOneAndUpdate(
          { provider, $or: [{ lease: null }, { "lease.expiresAt": { $lte: now } }] },
          {
            $set: {
              lease: { holder, acquiredAt: now, expiresAt: new Date(now.getTime() + ttlMs) },
              updatedAt: now.toISOString(),
            },
            $setOnInsert: defaults,
          },
          { upsert: true, returnDocument: "after" },
        );
        return result?.lease?.holder === holder;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return false;
        }
        throw error;
      }
    },
    async releaseLease(provider, holder) {
      await ready();
      await states().updateOne({ provider, "lease.holder": holder }, { $set: { lease: null } });
    },
    async recordSyncAttempt(provider, holder, at) {
      return updateIfHolder(provider, holder, {
        lastAttemptAt: at.toISOString(),
        updatedAt: at.toISOString(),
      });
    },
    async recordSyncSuccess(provider, holder, input) {
      const set: Record<string, unknown> = {
        siteUrl: input.siteUrl,
        lastSuccessAt: input.at.toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        lastRunId: input.runId,
        snapshot: input.snapshot,
        updatedAt: input.at.toISOString(),
      };
      if (input.lastDataDay) {
        set.lastDataDay = input.lastDataDay;
      }
      return updateIfHolder(provider, holder, set);
    },
    async recordSyncFailure(provider, holder, input) {
      return updateIfHolder(
        provider,
        holder,
        {
          siteUrl: input.siteUrl,
          lastFailureAt: input.at.toISOString(),
          lastError: { ...input.error, at: input.at.toISOString() },
          lastRunId: input.runId,
          updatedAt: input.at.toISOString(),
        },
        { consecutiveFailures: 1 },
      );
    },
    async clearExpiredSnapshots(now) {
      await ready();
      const result = await states().updateMany(
        { "snapshot.expiresAt": { $lte: now.toISOString() } },
        { $set: { snapshot: null } },
      );
      return result.modifiedCount;
    },
  };
}

let storeOverride: SearchPerformanceStore | null = null;
let memoryFallback: SearchPerformanceStore | null = null;
let mongoStore: SearchPerformanceStore | null = null;

export function getSearchPerformanceStore(): SearchPerformanceStore {
  if (storeOverride) {
    return storeOverride;
  }
  if (isMongoConfigured()) {
    mongoStore ??= createMongoSearchPerformanceStore();
    return mongoStore;
  }
  memoryFallback ??= createMemorySearchPerformanceStore();
  return memoryFallback;
}

/** Unit tests only. */
export function setSearchPerformanceStoreForTests(store: SearchPerformanceStore | null): void {
  if (store && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Search performance test store is unavailable.");
  }
  storeOverride = store;
}
