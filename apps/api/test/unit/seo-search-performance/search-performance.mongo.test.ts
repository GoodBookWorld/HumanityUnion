/**
 * SEO-12B.1 — search performance store on real MongoDB: cross-instance lease,
 * holder-fenced writes, unique/TTL indexes and their registration.
 *
 * Process-owned single-node MongoMemoryReplSet on 127.0.0.1 and one hu_test_ database.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";

import {
  assertExplicitIsolatedMongoTestTarget,
  lockExplicitIsolatedMongoTestConfig,
} from "../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getLockedMongoConfigForTests } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import {
  getMongoCollection,
  getMongoDatabase,
} from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { createMongoSearchPerformanceStore } from "../../../src/modules/seo-search-performance/search-performance.store.js";
import type { SearchDailyMetricRecord } from "../../../src/modules/seo-search-performance/search-performance.types.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_seo_search_${RUN}`;
const NOW = new Date("2026-11-03T20:00:00.000Z");
const TTL = 15 * 60_000;
const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

function daily(day: string, clicks: number): SearchDailyMetricRecord {
  return {
    provider: "google",
    siteUrl: "sc-domain:huws.org",
    day,
    clicks,
    impressions: clicks * 10,
    ctr: 0.1,
    position: 5,
    dataState: "final",
    collectedAt: NOW.toISOString(),
    syncRunId: "run",
    expiresAt: new Date("2028-03-01T00:00:00.000Z"),
  };
}

const snapshot = (expiresAt: Date) => ({
  collectedAt: NOW.toISOString(),
  expiresAt: expiresAt.toISOString(),
  topQueries: null,
  topPages: null,
  googlePeriodTotals: null,
  googleSitemaps: [],
  bingCrawl: null,
});

describe("SEO-12B.1 — search performance store (MongoDB)", () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
    process.env.NODE_TEST_ENV = "true";
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connectMongoClient();
    connected = true;
    assert.equal(getMongoDatabase().databaseName, DATABASE);
    await ensureMongoIndexes();
  });

  after(async () => {
    try {
      if (connected && getMongoDatabase().databaseName === DATABASE) {
        await getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  beforeEach(async () => {
    await getMongoCollection(MONGO_COLLECTIONS.seoSearchDailyMetrics).deleteMany({});
    await getMongoCollection(MONGO_COLLECTIONS.seoSearchSyncState).deleteMany({});
  });

  it("registers the unique and 16-month TTL indexes through ensureMongoIndexes", async () => {
    const metricIndexes = await getMongoCollection(
      MONGO_COLLECTIONS.seoSearchDailyMetrics,
    ).indexes();
    const unique = metricIndexes.find(
      (index) => index.name === "seo_search_daily_metrics_provider_site_day_unique",
    );
    assert.equal(unique?.unique, true);
    const ttl = metricIndexes.find(
      (index) => index.name === "seo_search_daily_metrics_expires_at_ttl",
    );
    assert.equal(ttl?.expireAfterSeconds, 0);
    const stateIndexes = await getMongoCollection(MONGO_COLLECTIONS.seoSearchSyncState).indexes();
    assert.equal(
      stateIndexes.find((index) => index.name === "seo_search_sync_state_provider_unique")?.unique,
      true,
    );
  });

  it("grants the lease to exactly one of many concurrent instances", async () => {
    const stores = Array.from({ length: 8 }, () => createMongoSearchPerformanceStore());
    const results = await Promise.all(
      stores.map((store, index) => store.acquireLease("google", `instance-${index}`, NOW, TTL)),
    );
    assert.equal(results.filter(Boolean).length, 1);
    const docs = await getMongoCollection(MONGO_COLLECTIONS.seoSearchSyncState)
      .find({ provider: "google" })
      .toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0]!.lease.holder, `instance-${results.indexOf(true)}`);
  });

  it("lets another instance take over an expired lease and fences out the old holder", async () => {
    const store = createMongoSearchPerformanceStore();
    assert.equal(await store.acquireLease("bing", "old", NOW, TTL), true);
    assert.equal(
      await store.acquireLease("bing", "new", new Date(NOW.getTime() + TTL - 1), TTL),
      false,
    );
    const later = new Date(NOW.getTime() + TTL + 1);
    assert.equal(await store.acquireLease("bing", "new", later, TTL), true);

    assert.equal(
      await store.recordSyncSuccess("bing", "old", {
        siteUrl: "https://huws.org/",
        at: later,
        runId: "r-old",
        lastDataDay: "2026-10-30",
        snapshot: snapshot(new Date(later.getTime() + 1000)),
      }),
      false,
    );
    await store.releaseLease("bing", "old");
    const state = await store.getSyncState("bing");
    assert.equal(state?.lease?.holder, "new");
    assert.equal(state?.lastSuccessAt, null);

    assert.equal(
      await store.recordSyncFailure("bing", "new", {
        siteUrl: "https://huws.org/",
        at: later,
        runId: "r-new",
        error: { code: "rate_limited", message: "Bing Webmaster rate limit reached (HTTP 429)." },
      }),
      true,
    );
    await store.recordSyncFailure("bing", "new", {
      siteUrl: "https://huws.org/",
      at: later,
      runId: "r-new-2",
      error: { code: "rate_limited", message: "x" },
    });
    assert.equal((await store.getSyncState("bing"))?.consecutiveFailures, 2);
    await store.releaseLease("bing", "new");
    assert.equal((await store.getSyncState("bing"))?.lease, null);
  });

  it("upserts one document per provider, site and day", async () => {
    const store = createMongoSearchPerformanceStore();
    await store.upsertDailyMetrics([daily("2026-10-30", 1), daily("2026-10-31", 2)]);
    await store.upsertDailyMetrics([daily("2026-10-31", 7)]);
    const rows = await store.listDailyMetrics({
      provider: "google",
      siteUrl: "sc-domain:huws.org",
      fromDay: "2026-10-01",
      toDay: "2026-11-30",
    });
    assert.deepEqual(
      rows.map((row) => [row.day, row.clicks]),
      [
        ["2026-10-30", 1],
        ["2026-10-31", 7],
      ],
    );
    assert.equal("_id" in rows[0]!, false);
    await assert.rejects(
      getMongoCollection(MONGO_COLLECTIONS.seoSearchDailyMetrics).insertOne({
        ...daily("2026-10-30", 9),
      }),
      (error: unknown) => (error as { code?: number }).code === 11000,
    );
  });

  it("clears expired snapshots and keeps the rest of the state", async () => {
    const store = createMongoSearchPerformanceStore();
    await store.acquireLease("google", "h", NOW, TTL);
    await store.recordSyncSuccess("google", "h", {
      siteUrl: "sc-domain:huws.org",
      at: NOW,
      runId: "r",
      lastDataDay: "2026-10-31",
      snapshot: snapshot(new Date(NOW.getTime() + 1000)),
    });
    assert.equal(await store.clearExpiredSnapshots(NOW), 0);
    assert.equal(await store.clearExpiredSnapshots(new Date(NOW.getTime() + 1000)), 1);
    const state = await store.getSyncState("google");
    assert.equal(state?.snapshot, null);
    assert.equal(state?.lastDataDay, "2026-10-31");
  });
});
