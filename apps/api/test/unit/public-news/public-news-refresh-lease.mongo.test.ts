/**
 * RSS-SOURCE-02B.1 — public news refresh lease and fenced ingestion on real MongoDB:
 * atomic acquisition, expiry takeover, owner-only release and renewal, heartbeat
 * beyond the TTL, fail-closed storage errors, and a refresh that loses its lease.
 *
 * Process-owned single-node MongoMemoryReplSet on 127.0.0.1 and one hu_test_ database.
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "mongodb";
process.env.NEWS_PROVIDER_ENABLED = "true";
process.env.NEWS_PROVIDER_NAME = "rss";
process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
// test-setup enables verification mode, which swaps in the mock provider.
delete process.env.HU_VERIFICATION_MODE;

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import dnsPromises from "node:dns/promises";
import { after, before, beforeEach, describe, it, mock } from "node:test";

import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type { MediaResource, NewsArticleRecord } from "@hu/types";

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
import {
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { setLanguageRegistryForceMemoryForTests } from "../../../src/modules/language/index.js";
import { ensureMediaResourcesSeededOnce } from "../../../src/modules/media-resources/media-resource.service.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import {
  setPublicNewsRefreshLeaseFailureForTests,
  tryAcquirePublicNewsRefreshLease,
  type PublicNewsRefreshLease,
} from "../../../src/modules/public-news/public-news-refresh-lease.js";
import { refreshApprovedNewsSourcesFromMediaResources } from "../../../src/modules/public-news/public-news.config.js";
import {
  setExternalFetchRetrySleepForTests,
  setExternalHttpTransportForTests,
} from "../../../src/modules/public-news/public-news.fetch.js";
import { normalizeExternalNewsArticle } from "../../../src/modules/public-news/public-news.normalize.js";
import { upsertPublicNewsRecords } from "../../../src/modules/public-news/public-news.repository.js";
import { refreshPublicNews } from "../../../src/modules/public-news/public-news.service.js";
import { toExternalHttpResponse } from "../../helpers/fake-external-http.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_public_news_lease_${RUN}`;
const T0 = new Date("2026-11-06T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const lockedBeforeThisSuite = getLockedMongoConfigForTests();
const FEED = "https://www.pravda.com.ua/rss/view_news/";

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

const leases = () => getMongoCollection<{ _id: string }>(MONGO_COLLECTIONS.publicNewsRefreshLease);
const articles = () => getMongoCollection<NewsArticleRecord>(MONGO_COLLECTIONS.publicNewsArticles);
const leaseDoc = () => leases().findOne({ _id: "public-news-refresh" });

function acquired(
  result: Awaited<ReturnType<typeof tryAcquirePublicNewsRefreshLease>>,
): PublicNewsRefreshLease {
  assert.equal(result.acquired, true);
  return (result as { lease: PublicNewsRefreshLease }).lease;
}

function rss(urls: string[]): string {
  const now = new Date();
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${urls
    .map(
      (url, n) =>
        `<item><title>Lease fenced article number ${n}</title><link>${url}</link><guid>${url}</guid><description>Summary text for lease article ${n}.</description><pubDate>${now.toUTCString()}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}

const source: MediaResource = {
  id: "pravda-ua",
  resourceType: "NEWS_SOURCE",
  scopeType: "COUNTRY",
  countryCode: "UA",
  name: "Українська правда",
  logoLabel: "УП",
  websiteUrl: "https://www.pravda.com.ua",
  rssUrl: FEED,
  language: "en",
  providerId: null,
  active: true,
  sortOrder: 1,
  createdAt: T0.toISOString(),
  updatedAt: T0.toISOString(),
};

describe("RSS-SOURCE-02B.1 — refresh lease (MongoDB)", () => {
  if (lockedBeforeThisSuite) {
    it("NOT_RUN_EXTERNAL_MONGO_CONFIGURED", () => {
      assert.notEqual(lockedBeforeThisSuite, null);
    });
    return;
  }

  before(async () => {
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

    setMediaResourceForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setPlpAutoBuildWorkForceMemoryForTests(true);
    setPublishedLocalizationPersistenceModeForTests("memory");
    await ensureMediaResourcesSeededOnce();
    resetMediaResourcesMemoryForTests();
    upsertMediaResourceMemory(source);
    await refreshApprovedNewsSourcesFromMediaResources();
    mock.method(dnsPromises, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
    setExternalFetchRetrySleepForTests(async () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    setExternalHttpTransportForTests(null);
    setExternalFetchRetrySleepForTests(null);
    setPublicNewsRefreshLeaseFailureForTests(null);
    setMediaResourceForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setPlpAutoBuildWorkForceMemoryForTests(false);
    try {
      if (!connected) {
        await connectMongoClient();
        connected = true;
      }
      if (getMongoDatabase().databaseName === DATABASE) {
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
    await leases().deleteMany({});
    await articles().deleteMany({});
    setPublicNewsRefreshLeaseFailureForTests(null);
  });

  it("1. simultaneous instances: exactly one acquires; the others see the holder's expiry", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, n) =>
        tryAcquirePublicNewsRefreshLease({
          now: T0,
          ttlMs: 60_000,
          renewEveryMs: 0,
          holderId: `i${n}`,
        }),
      ),
    );
    const winners = results.filter((result) => result.acquired);
    assert.equal(winners.length, 1);
    for (const loser of results.filter((result) => !result.acquired)) {
      assert.deepEqual(loser, { acquired: false, reason: "held", retryAt: at(60_000).getTime() });
    }
    assert.equal(await leases().countDocuments({}), 1);
    const doc = (await leaseDoc()) as unknown as { holderId: string };
    assert.equal(doc.holderId, winners[0]!.acquired ? winners[0]!.lease.holderId : "");
  });

  it("2. expired lease is taken over; the stale holder can neither renew nor release", async () => {
    const a = acquired(
      await tryAcquirePublicNewsRefreshLease({
        now: T0,
        ttlMs: 1_000,
        renewEveryMs: 0,
        holderId: "A",
      }),
    );
    const early = await tryAcquirePublicNewsRefreshLease({
      now: at(999),
      ttlMs: 1_000,
      renewEveryMs: 0,
      holderId: "B",
    });
    assert.equal(early.acquired, false);
    const b = acquired(
      await tryAcquirePublicNewsRefreshLease({
        now: at(1_000),
        ttlMs: 1_000,
        renewEveryMs: 0,
        holderId: "B",
      }),
    );
    assert.equal(await a.confirm(at(1_001)), false, "stale holder cannot renew");
    await a.release({ completed: true, now: at(1_002) });
    const doc = (await leaseDoc()) as unknown as Record<string, unknown>;
    assert.equal(doc.holderId, "B", "non-owner release has no effect");
    assert.equal(doc.lastCompletedAt ?? null, null, "non-owner cannot record completion");
    assert.equal(await b.confirm(at(1_500)), true);
    await b.release({ completed: true, now: at(1_600) });
    const released = (await leaseDoc()) as unknown as Record<string, unknown>;
    assert.deepEqual(
      [released.holderId, released.lastCompletedAt],
      [null, at(1_600).toISOString()],
    );
  });

  it("3. owner renewal extends the lease; maximum hold time ends ownership", async () => {
    const a = acquired(
      await tryAcquirePublicNewsRefreshLease({
        now: T0,
        ttlMs: 1_000,
        maxHoldMs: 5_000,
        renewEveryMs: 0,
        holderId: "A",
      }),
    );
    assert.equal(await a.confirm(at(900)), true);
    const blocked = await tryAcquirePublicNewsRefreshLease({
      now: at(1_500),
      ttlMs: 1_000,
      renewEveryMs: 0,
    });
    assert.deepEqual(blocked, { acquired: false, reason: "held", retryAt: at(1_900).getTime() });
    assert.equal(await a.confirm(at(5_001)), false, "beyond the maximum hold");
  });

  it("4. refresh longer than the TTL: the heartbeat keeps the lease, then max hold releases it", async () => {
    const a = acquired(
      await tryAcquirePublicNewsRefreshLease({
        ttlMs: 300,
        renewEveryMs: 100,
        maxHoldMs: 900,
        holderId: "A",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 650));
    const during = await tryAcquirePublicNewsRefreshLease({
      ttlMs: 300,
      renewEveryMs: 0,
      holderId: "B",
    });
    assert.equal(during.acquired, false, "heartbeat renewed past the original 300 ms TTL");
    await new Promise((resolve) => setTimeout(resolve, 700));
    const afterMaxHold = await tryAcquirePublicNewsRefreshLease({
      ttlMs: 300,
      renewEveryMs: 0,
      holderId: "B",
    });
    assert.equal(afterMaxHold.acquired, true, "renewal stops after the maximum hold time");
    assert.equal(await a.confirm(), false);
  });

  it("5. follow-ups: a refresh completed after the skip suppresses the duplicate; a failed one does not", async () => {
    const skippedAt = at(10);
    const a = acquired(
      await tryAcquirePublicNewsRefreshLease({
        now: T0,
        ttlMs: 1_000,
        renewEveryMs: 0,
        holderId: "A",
      }),
    );
    await a.release({ completed: true, now: at(500) });
    const followUps = await Promise.all(
      ["F1", "F2"].map((holderId) =>
        tryAcquirePublicNewsRefreshLease({
          now: at(600),
          renewEveryMs: 0,
          skipIfCompletedSince: skippedAt,
          holderId,
        }),
      ),
    );
    assert.deepEqual(followUps, [
      { acquired: false, reason: "completed_since" },
      { acquired: false, reason: "completed_since" },
    ]);

    await leases().deleteMany({});
    const crashed = acquired(
      await tryAcquirePublicNewsRefreshLease({
        now: T0,
        ttlMs: 1_000,
        renewEveryMs: 0,
        holderId: "A",
      }),
    );
    await crashed.release({ completed: false, now: at(500) });
    const retry = await Promise.all(
      ["F1", "F2"].map((holderId) =>
        tryAcquirePublicNewsRefreshLease({
          now: at(600),
          renewEveryMs: 0,
          skipIfCompletedSince: skippedAt,
          holderId,
        }),
      ),
    );
    assert.equal(retry.filter((result) => result.acquired).length, 1, "exactly one follow-up runs");
  });

  it("6. refresh writes articles only while holding the lease (Mongo persistence)", async () => {
    const other = acquired(
      await tryAcquirePublicNewsRefreshLease({
        ttlMs: 60_000,
        renewEveryMs: 0,
        holderId: "other-instance",
      }),
    );
    let fetches = 0;
    setExternalHttpTransportForTests(async () => {
      fetches += 1;
      return toExternalHttpResponse({
        status: 200,
        body: rss(["https://www.pravda.com.ua/eng/news/2026/11/06/7512001/"]),
      });
    });
    const skipped = await refreshPublicNews();
    assert.equal(skipped.skipped, "lease_held");
    assert.equal(fetches, 0);
    assert.equal(await articles().countDocuments({}), 0);

    await other.release({ completed: false });
    const ran = await refreshPublicNews();
    assert.equal(ran.skipped, undefined);
    assert.equal(ran.upserted, 1);
    const stored = await articles().find({}).toArray();
    assert.deepEqual(
      stored.map((record) => [record.sourceName, record.mediaResourceId]),
      [["Українська правда", "pravda-ua"]],
    );
    const doc = (await leaseDoc()) as unknown as Record<string, unknown>;
    assert.equal(doc.holderId, null);
    assert.ok(doc.lastCompletedAt);
  });

  it("7. lease lost mid-refresh: nothing is written and existing articles are preserved", async () => {
    await articles().insertOne({
      id: "news-existing",
      provider: "rss",
      sourceName: "Українська правда",
      title: "Existing article that must survive",
      summary: "Existing summary.",
      articleUrl: "https://www.pravda.com.ua/eng/news/2026/11/05/7500000/",
      normalizedArticleUrl: "https://www.pravda.com.ua/eng/news/2026/11/05/7500000/",
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      language: "en",
      status: "active",
      verificationStatus: "external-source",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as NewsArticleRecord);
    setExternalHttpTransportForTests(async () => {
      // Simulates the lease expiring and another instance taking it during the fetch.
      await leases().updateOne(
        { _id: "public-news-refresh" },
        { $set: { holderId: "newer-instance" } },
      );
      return toExternalHttpResponse({
        status: 200,
        body: rss(["https://www.pravda.com.ua/eng/news/2026/11/06/7512002/"]),
      });
    });
    const result = await refreshPublicNews();
    assert.equal(result.skipped, "lease_lost");
    assert.deepEqual(
      (await articles().find({}).toArray()).map((record) => record.id),
      ["news-existing"],
    );
    const doc = (await leaseDoc()) as unknown as Record<string, unknown>;
    assert.equal(doc.holderId, "newer-instance", "the lost holder does not release the new one");
  });

  it("9. RSS-SOURCE-02B.2 upsert: a missing image never erases the stored one; a new image replaces it", async () => {
    const base = {
      provider: "rss",
      sourceName: "Українська правда",
      title: "Mongo image persistence article",
      articleUrl: "https://www.pravda.com.ua/eng/news/2026/11/06/7512300/",
      publishedAt: new Date().toISOString(),
      language: "en",
      mediaResourceId: "pravda-ua",
    };
    const first = normalizeExternalNewsArticle(
      { ...base, imageUrl: "https://uimg.pravda.com.ua/images/first.jpeg" },
      7,
    );
    await upsertPublicNewsRecords([first]);
    const withoutImage = normalizeExternalNewsArticle(base, 7);
    assert.equal(
      "imageUrl" in withoutImage,
      true,
      "normalized records carry an undefined imageUrl",
    );
    await upsertPublicNewsRecords([withoutImage]);
    let docs = await articles().find({}).toArray();
    assert.equal(docs.length, 1);
    assert.equal(docs[0]?.imageUrl, "https://uimg.pravda.com.ua/images/first.jpeg");

    await upsertPublicNewsRecords([
      normalizeExternalNewsArticle(
        { ...base, imageUrl: "https://uimg.pravda.com.ua/images/new.jpeg" },
        7,
      ),
    ]);
    docs = await articles().find({}).toArray();
    assert.deepEqual(
      docs.map((doc) => [doc.id, doc.imageUrl]),
      [[first.id, "https://uimg.pravda.com.ua/images/new.jpeg"]],
    );
  });

  it("8. storage errors fail closed: no acquisition, no fetch, no writes, renewal refused", async () => {
    let fetches = 0;
    setExternalHttpTransportForTests(async () => {
      fetches += 1;
      return toExternalHttpResponse({ status: 200, body: rss([]) });
    });
    setPublicNewsRefreshLeaseFailureForTests(new Error("simulated lease store outage"));
    const result = await refreshPublicNews();
    assert.deepEqual(result, { upserted: 0, fetched: 0, skipped: "lease_unavailable" });
    assert.equal(fetches, 0);
    setPublicNewsRefreshLeaseFailureForTests(null);

    // Real driver failure: a disconnected client rejects; an existing holder cannot renew.
    const a = acquired(
      await tryAcquirePublicNewsRefreshLease({ ttlMs: 60_000, renewEveryMs: 0, holderId: "A" }),
    );
    await disconnectMongoClient();
    connected = false;
    await assert.rejects(tryAcquirePublicNewsRefreshLease({ renewEveryMs: 0, holderId: "B" }));
    assert.equal(await a.confirm(), false, "renewal fails closed while the store is unreachable");
    await connectMongoClient();
    connected = true;
    assert.equal(await a.confirm(), true, "ownership is intact once the store is back");
  });
});
