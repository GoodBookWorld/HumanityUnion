/**
 * MEDIA-NEWS-01B — carousel candidate aggregation on real MongoDB: grouping per source
 * (MediaResource id, or name for legacy rows), the per-source bound, parity with the
 * memory implementation, and a query count that does not grow with the source count.
 *
 * Process-owned single-node MongoMemoryReplSet on 127.0.0.1 and one hu_test_ database.
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "mongodb";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it, mock } from "node:test";

import { Collection } from "mongodb";
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
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { selectMediaCarouselNewsRecords } from "../../../src/modules/public-news/public-news-media-carousel.js";
import { findPublicNewsCarouselCandidates } from "../../../src/modules/public-news/public-news.repository.js";
import {
  listPublicNewsArticles,
  parsePublicNewsQuery,
} from "../../../src/modules/public-news/public-news.service.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_media_carousel_${RUN}`;
const NOW = "2026-11-06T12:00:00.000Z";
const lockedBeforeThisSuite = getLockedMongoConfigForTests();

let replSet: MongoMemoryReplSet | null = null;
let connected = false;

const articles = () => getMongoCollection<NewsArticleRecord>(MONGO_COLLECTIONS.publicNewsArticles);

function newsSource(n: number, overrides: Partial<MediaResource> = {}): MediaResource {
  return {
    id: `src-${n}`,
    resourceType: "NEWS_SOURCE",
    scopeType: "WORLD",
    countryCode: null,
    name: `Source ${n}`,
    logoLabel: `S${n}`,
    websiteUrl: `https://source-${n}.example.org`,
    rssUrl: `https://source-${n}.example.org/rss`,
    language: "en",
    active: true,
    sortOrder: n,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function record(
  sourceIndex: number,
  k: number,
  overrides: Partial<NewsArticleRecord> = {},
): NewsArticleRecord {
  const url = `https://source-${sourceIndex}.example.org/world/story-${sourceIndex}-${k}`;
  return {
    id: `news-${sourceIndex}-${k}`,
    provider: "rss",
    sourceName: `Source ${sourceIndex}`,
    mediaResourceId: `src-${sourceIndex}`,
    title: `Story ${sourceIndex}-${k}`,
    summary: "Summary.",
    articleUrl: url,
    normalizedArticleUrl: url,
    publishedAt: new Date(Date.parse(NOW) - (sourceIndex * 10 + k) * 60_000).toISOString(),
    fetchedAt: NOW,
    expiresAt: "2026-11-13T12:00:00.000Z",
    language: "en",
    status: "active",
    verificationStatus: "external-source",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("MEDIA-NEWS-01B — carousel aggregation (MongoDB)", () => {
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
  });

  after(async () => {
    mock.restoreAll();
    setMediaResourceForceMemoryForTests(false);
    resetMediaResourcesMemoryForTests();
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
    await articles().deleteMany({});
    resetMediaResourcesMemoryForTests();
  });

  it("1. groups by MediaResource id (legacy: by name), newest first, at most N per source", async () => {
    await articles().insertMany([
      ...[1, 2].flatMap((n) => Array.from({ length: 5 }, (_, k) => record(n, k))),
      ...Array.from({ length: 4 }, (_, k) => {
        const { mediaResourceId: _omit, ...legacy } = record(3, k);
        return legacy;
      }),
      record(4, 0, { status: "expired" }),
      record(5, 0, { language: "uk" }),
      record(6, 0, { expiresAt: "2026-11-01T00:00:00.000Z" }),
    ]);
    const candidates = await findPublicNewsCarouselCandidates({
      language: "en",
      perSource: 3,
      now: NOW,
    });
    const byGroup = new Map<string, string[]>();
    for (const candidate of candidates) {
      const key = candidate.mediaResourceId ?? `name:${candidate.sourceName}`;
      byGroup.set(key, [...(byGroup.get(key) ?? []), candidate.id]);
    }
    assert.deepEqual([...byGroup.keys()].sort(), ["name:Source 3", "src-1", "src-2"]);
    assert.deepEqual(byGroup.get("src-1")?.sort(), ["news-1-0", "news-1-1", "news-1-2"]);
    assert.deepEqual(byGroup.get("name:Source 3")?.sort(), ["news-3-0", "news-3-1", "news-3-2"]);
    assert.ok(candidates.every((candidate) => !("_id" in candidate)));
  });

  it("2. one aggregation and no per-source queries, however many sources exist", async () => {
    for (let n = 1; n <= 25; n += 1) {
      upsertMediaResourceMemory(newsSource(n));
    }
    await articles().insertMany(
      Array.from({ length: 25 }, (_, n) =>
        Array.from({ length: 4 }, (__, k) => record(n + 1, k)),
      ).flat(),
    );
    const calls: string[] = [];
    for (const method of ["aggregate", "find", "findOne", "distinct", "countDocuments"] as const) {
      const original = Collection.prototype[method] as (...args: unknown[]) => unknown;
      mock.method(Collection.prototype, method, function (this: Collection, ...args: unknown[]) {
        if (this.collectionName === MONGO_COLLECTIONS.publicNewsArticles) {
          calls.push(method);
        }
        return original.apply(this, args);
      });
    }
    const selected = await selectMediaCarouselNewsRecords({ limit: 12, language: "en", now: NOW });
    assert.equal(selected.length, 12);
    assert.deepEqual(calls, ["aggregate"]);

    calls.length = 0;
    const listing = await listPublicNewsArticles(
      parsePublicNewsQuery({ carousel: "media", limit: "12", language: "en" }),
    );
    assert.equal(listing.items.length, 12);
    assert.deepEqual(
      calls.sort(),
      ["aggregate", "distinct"],
      "selection + existing activeProviders",
    );
    mock.restoreAll();
  });

  it("3. Mongo and memory implementations select the same articles in the same order", async () => {
    const resources = [1, 2, 3, 4].map((n) => newsSource(n));
    resources.push(newsSource(5, { websiteUrl: "https://www.theguardian.com", name: "Guardian" }));
    for (const resource of resources) {
      upsertMediaResourceMemory(resource);
    }
    const docs = [
      ...[1, 2, 3, 4].flatMap((n) => Array.from({ length: 4 }, (_, k) => record(n, k))),
      ...Array.from({ length: 3 }, (_, k) =>
        record(5, k, {
          articleUrl: `https://www.theguardian.com/world/2026/nov/06/g-${k}`,
          normalizedArticleUrl: `https://www.theguardian.com/world/2026/nov/06/g-${k}`,
          publishedAt: new Date(Date.parse(NOW) - (200 + k) * 60_000).toISOString(),
        }),
      ),
    ];
    await articles().insertMany(docs.map((doc) => ({ ...doc })));
    const fromMongo = (
      await selectMediaCarouselNewsRecords({ limit: 8, language: "en", now: NOW })
    ).map((entry) => entry.id);

    process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
    const { resetPublicNewsMemoryStoreForTests, upsertPublicNewsRecords } =
      await import("../../../src/modules/public-news/public-news.repository.js");
    resetPublicNewsMemoryStoreForTests();
    await upsertPublicNewsRecords(docs);
    const fromMemory = (
      await selectMediaCarouselNewsRecords({ limit: 8, language: "en", now: NOW })
    ).map((entry) => entry.id);
    resetPublicNewsMemoryStoreForTests();
    process.env.PUBLIC_NEWS_PERSISTENCE = "mongodb";

    assert.deepEqual(fromMongo, fromMemory);
    assert.equal(
      fromMongo.filter((id) => id.startsWith("news-5-")).length,
      2,
      "priority Guardian, two",
    );
  });
});
