/**
 * RSS-HEALTH-01 — per-source RSS health telemetry recorded by the existing refresh,
 * and the read-only Admin health endpoint. Real refresh + RSS provider, mocked network.
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
process.env.NEWS_PROVIDER_ENABLED = "true";
process.env.NEWS_PROVIDER_NAME = "rss";
process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
delete process.env.MONGODB_URI;
// test-setup enables verification mode, which swaps in the mock provider.
delete process.env.HU_VERIFICATION_MODE;

import assert from "node:assert/strict";
import dnsPromises from "node:dns/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";

import express from "express";
import type { MediaResource, NewsArticleRecord, PublicNewsSourceHealthRecord } from "@hu/types";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  resetPublishedLocalizationPersistenceForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import adminMediaResourcesRouter from "../../../src/modules/media-resources/admin-media-resources.routes.js";
import {
  ensureMediaResourcesSeededOnce,
  listAdminNewsSourceHealth,
  setMediaResourceAdminAssertOverrideForTests,
} from "../../../src/modules/media-resources/media-resource.service.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import {
  classifySourceFetchError,
  resolveNewsSourceHealthStatus,
} from "../../../src/modules/public-news/public-news-source-health.js";
import {
  listPublicNewsSourceHealth,
  resetPublicNewsSourceHealthForTests,
  setPublicNewsSourceHealthWriteFailureForTests,
} from "../../../src/modules/public-news/public-news-source-health.repository.js";
import { refreshApprovedNewsSourcesFromMediaResources } from "../../../src/modules/public-news/public-news.config.js";
import { ExternalRequestError } from "../../../src/modules/public-news/public-news.fetch.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
} from "../../../src/modules/public-news/public-news.repository.js";
import {
  listPublicNewsArticles,
  refreshPublicNews,
} from "../../../src/modules/public-news/public-news.service.js";

const TIMESTAMP = "2026-10-01T00:00:00.000Z";
const FEEDS = {
  ukrinform: "https://www.ukrinform.net/rss/block-lastnews",
  kyiv: "https://kyivindependent.com/news/feed/",
  pravda: "https://www.eurointegration.com.ua/rss/",
  economist: "https://www.economist.com/international/rss.xml",
  france24: "https://www.france24.com/en/rss",
};

function newsSource(
  id: string,
  name: string,
  rssUrl: string,
  overrides: Partial<MediaResource> = {},
): MediaResource {
  return {
    id,
    resourceType: "NEWS_SOURCE",
    scopeType: "COUNTRY",
    countryCode: "UA",
    name,
    logoLabel: name.slice(0, 2),
    websiteUrl: new URL(rssUrl).origin,
    rssUrl,
    language: "en",
    providerId: id,
    active: true,
    sortOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function rss(items: { url: string; title: string; publishedAt: Date }[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>${item.url}</link><guid>${item.url}</guid><description>Summary for ${item.title} with enough words.</description><pubDate>${item.publishedAt.toUTCString()}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const ukrinformItems = [1, 2, 3].map((n) => ({
  url: `https://www.ukrinform.net/rubric-society/418220${n}-health-telemetry-article-${n}.html`,
  title: `Ukrinform health telemetry article number ${n}`,
  publishedAt: hoursAgo(n),
}));
const economistItems = [1, 2].map((n) => ({
  url: `https://www.economist.com/international/2026/08/0${n}/old-analysis-${n}`,
  title: `An old Economist analysis piece number ${n}`,
  publishedAt: new Date(Date.now() - (40 + n) * 86_400_000),
}));

let feedResponses: Record<string, () => Response> = {};
let fetchedUrls: string[] = [];

function installNetworkMocks(): void {
  mock.method(dnsPromises, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchedUrls.push(url);
    const respond = feedResponses[url];
    if (!respond) {
      throw new TypeError("fetch failed");
    }
    return respond();
  });
}

function defaultFeeds(): Record<string, () => Response> {
  return {
    [FEEDS.ukrinform]: () => new Response(rss(ukrinformItems), { status: 200 }),
    [FEEDS.kyiv]: () => new Response("Not found", { status: 404 }),
    [FEEDS.pravda]: () => new Response("<html><body>Not a feed</body></html>", { status: 200 }),
    [FEEDS.economist]: () => new Response(rss(economistItems), { status: 200 }),
    [FEEDS.france24]: () => new Response(rss([]), { status: 200 }),
  };
}

async function seedSources(overrides: Record<string, Partial<MediaResource>> = {}): Promise<void> {
  resetMediaResourcesMemoryForTests();
  for (const resource of [
    newsSource("ukrinform", "Ukrinform", FEEDS.ukrinform, overrides.ukrinform),
    newsSource("kyiv-independent", "Kyiv Independent", FEEDS.kyiv, overrides["kyiv-independent"]),
    newsSource("european-pravda", "European Pravda", FEEDS.pravda, overrides["european-pravda"]),
    newsSource("the-economist", "The Economist", FEEDS.economist, {
      countryCode: "GB",
      ...overrides["the-economist"],
    }),
    newsSource("france24", "France24", FEEDS.france24, {
      countryCode: "FR",
      active: false,
      ...overrides.france24,
    }),
  ]) {
    upsertMediaResourceMemory(resource);
  }
  await refreshApprovedNewsSourcesFromMediaResources();
}

async function healthOf(id: string): Promise<PublicNewsSourceHealthRecord | undefined> {
  return (await listPublicNewsSourceHealth([id])).get(id);
}

function storedArticles(): Promise<NewsArticleRecord[]> {
  return findActivePublicNewsRecords({ limit: 50, language: "en" });
}

const admin = async (userId: string) => {
  if (userId !== "admin-user") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId, memberId: "admin-member" };
};

before(async () => {
  setMediaResourceForceMemoryForTests(true);
  setLanguageRegistryForceMemoryForTests(true);
  setPlpAutoBuildWorkForceMemoryForTests(true);
  setPublishedLocalizationPersistenceModeForTests("memory");
  installNetworkMocks();
  await ensureMediaResourcesSeededOnce();
});

beforeEach(async () => {
  feedResponses = defaultFeeds();
  fetchedUrls = [];
  resetPublicNewsMemoryStoreForTests();
  resetPublicNewsSourceHealthForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPublishedLocalizationPersistenceForTests();
  setMediaResourceAdminAssertOverrideForTests(admin);
  await seedSources();
});

afterEach(() => {
  setPublicNewsSourceHealthWriteFailureForTests(false);
  setMediaResourceAdminAssertOverrideForTests(null);
});

after(() => {
  mock.restoreAll();
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  resetPublicNewsSourceHealthForTests();
  setMediaResourceForceMemoryForTests(false);
  setLanguageRegistryForceMemoryForTests(false);
  resetLanguageRegistryStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
});

describe("RSS-HEALTH-01 — telemetry recorded by the existing refresh", () => {
  it("1. successful feed: fetch, parse, acceptance and public availability", async () => {
    const result = await refreshPublicNews();
    // fetched = articles returned by the provider before filtering (3 Ukrinform + 2 Economist).
    assert.deepEqual(result, { upserted: 3, fetched: 5 });
    const health = await healthOf("ukrinform");
    assert.ok(health);
    assert.equal(health.lastOutcome, "success");
    assert.equal(health.lastHttpStatus, 200);
    assert.equal(health.lastParsedCount, 3);
    assert.equal(health.lastAcceptedCount, 3);
    assert.equal(health.lastRejectedCount, 0);
    assert.deepEqual(health.lastStoredSourceNames, ["Ukrinform"]);
    assert.equal(health.consecutiveFailures, 0);
    assert.equal(health.lastError, null);
    assert.equal(health.feedHost, "www.ukrinform.net");
    assert.equal(
      health.lastItemPublishedAt,
      ukrinformItems[0]!.publishedAt.toISOString().replace(/\.\d{3}Z$/, ".000Z"),
    );
    assert.ok(health.lastSuccessAt && health.lastCheckCompletedAt === health.lastSuccessAt);
    assert.ok(health.lastDurationMs >= 0);
  });

  it("2. HTTP failure: sanitized error, status kept, failures accumulate", async () => {
    await refreshPublicNews();
    let health = await healthOf("kyiv-independent");
    assert.equal(health?.lastOutcome, "fetch_failed");
    assert.deepEqual(health?.lastError, {
      code: "http_error",
      message: "The feed responded with HTTP 404.",
      httpStatus: 404,
    });
    assert.equal(health?.lastHttpStatus, 404);
    assert.equal(health?.consecutiveFailures, 1);
    assert.equal(health?.lastSuccessAt, null);
    await refreshPublicNews();
    health = await healthOf("kyiv-independent");
    assert.equal(health?.consecutiveFailures, 2);
  });

  it("3. invalid feed: fetch succeeded, parsing failed", async () => {
    await refreshPublicNews();
    const health = await healthOf("european-pravda");
    assert.equal(health?.lastOutcome, "parse_failed");
    assert.equal(health?.lastHttpStatus, 200);
    assert.equal(health?.lastParsedCount, 0);
    assert.equal(health?.lastError?.code, "invalid_feed");
    assert.equal(health?.consecutiveFailures, 1);
  });

  it("4. filtered-out articles: parsed but rejected with reasons", async () => {
    await refreshPublicNews();
    const health = await healthOf("the-economist");
    assert.equal(health?.lastOutcome, "success");
    assert.equal(health?.lastParsedCount, 2);
    assert.equal(health?.lastAcceptedCount, 0);
    assert.equal(health?.lastRejectedCount, 2);
    assert.deepEqual(health?.lastRejectionReasons, { outside_retention_window: 2 });
  });

  it("5. zero new articles: a repeat check stays successful and healthy", async () => {
    await refreshPublicNews();
    const firstSuccess = (await healthOf("ukrinform"))?.lastSuccessAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await refreshPublicNews();
    const health = await healthOf("ukrinform");
    assert.equal(health?.lastOutcome, "success");
    assert.equal(health?.lastAcceptedCount, 3);
    assert.equal(health?.consecutiveFailures, 0);
    assert.notEqual(health?.lastSuccessAt, firstSuccess);
    assert.equal((await storedArticles()).filter((a) => a.sourceName === "Ukrinform").length, 3);
  });

  it("6. disabled source: not fetched, no telemetry written", async () => {
    await refreshPublicNews();
    assert.ok(!fetchedUrls.includes(FEEDS.france24));
    assert.equal(await healthOf("france24"), undefined);
  });

  it("7. renamed source: same record id, stored name mismatch is visible", async () => {
    await refreshPublicNews();
    await seedSources({ ukrinform: { name: "Укрінформ" } });
    await refreshPublicNews();
    const health = await healthOf("ukrinform");
    assert.equal(health?.sourceName, "Укрінформ");
    assert.deepEqual(health?.lastStoredSourceNames, ["Ukrinform"]);
    const listing = await listAdminNewsSourceHealth({ actorUserId: "admin-user" });
    const item = listing.items.find((entry) => entry.mediaResourceId === "ukrinform");
    assert.equal(item?.name, "Укрінформ");
    assert.equal(item?.publicArticleCount, 0);
    assert.deepEqual([item?.status, item?.statusReason], ["failing", "no_public_articles"]);
  });

  it("8. telemetry storage failure never breaks ingestion", async () => {
    setPublicNewsSourceHealthWriteFailureForTests(true);
    const result = await refreshPublicNews();
    // fetched = articles returned by the provider before filtering (3 Ukrinform + 2 Economist).
    assert.deepEqual(result, { upserted: 3, fetched: 5 });
    assert.equal((await storedArticles()).length, 3);
    setPublicNewsSourceHealthWriteFailureForTests(false);
    assert.equal(await healthOf("ukrinform"), undefined);
  });
});

describe("RSS-HEALTH-01 — existing ingestion unchanged", () => {
  it("9. stored articles and public output are identical with telemetry storage on or off", async () => {
    const snapshot = async () =>
      (await storedArticles())
        .map(({ fetchedAt: _f, createdAt: _c, updatedAt: _u, expiresAt: _e, ...rest }) => rest)
        .sort((a, b) => a.id.localeCompare(b.id));
    await refreshPublicNews();
    const withTelemetry = await snapshot();
    const publicWith = (await listPublicNewsArticles({ limit: 50 })).items.map((item) => item.id);

    resetPublicNewsMemoryStoreForTests();
    setPublicNewsSourceHealthWriteFailureForTests(true);
    await refreshPublicNews();
    const withoutTelemetry = await snapshot();
    const publicWithout = (await listPublicNewsArticles({ limit: 50 })).items.map(
      (item) => item.id,
    );

    assert.deepEqual(withTelemetry, withoutTelemetry);
    assert.deepEqual(publicWith, publicWithout);
    assert.ok(
      withTelemetry.every((record) => !("mediaResourceId" in record)),
      "attribution is not persisted",
    );
    assert.deepEqual(
      withTelemetry.map((record) => record.sourceName),
      ["Ukrinform", "Ukrinform", "Ukrinform"],
    );
  });
});

describe("RSS-HEALTH-01 — Admin health listing", () => {
  it("10. statuses, counters and public counts per resource", async () => {
    await refreshPublicNews();
    const listing = await listAdminNewsSourceHealth({ actorUserId: "admin-user" });
    const byId = Object.fromEntries(listing.items.map((item) => [item.mediaResourceId, item]));
    assert.deepEqual([byId.ukrinform?.status, byId.ukrinform?.publicArticleCount], ["healthy", 3]);
    assert.deepEqual(
      [byId["kyiv-independent"]?.status, byId["kyiv-independent"]?.statusReason],
      ["failing", "fetch_failed"],
    );
    assert.deepEqual(
      [byId["european-pravda"]?.status, byId["european-pravda"]?.statusReason],
      ["failing", "parse_failed"],
    );
    assert.deepEqual(
      [byId["the-economist"]?.status, byId["the-economist"]?.statusReason],
      ["failing", "no_public_articles"],
    );
    assert.deepEqual([byId.france24?.status, byId.france24?.active], ["never_checked", false]);
    assert.equal(listing.staleAfterHours, 12);
    assert.equal(listing.publicArticleCountCap, 50);
    assert.equal(listing.truncated, false);
    const activeOnly = await listAdminNewsSourceHealth({ actorUserId: "admin-user", active: true });
    assert.ok(!activeOnly.items.some((item) => item.mediaResourceId === "france24"));
  });

  it("11. status rules: stale when not checked recently or the feed stops updating", () => {
    const now = Date.parse("2026-11-06T12:00:00.000Z");
    const base: PublicNewsSourceHealthRecord = {
      mediaResourceId: "x",
      sourceName: "X",
      providerId: "x",
      feedHost: "x.example",
      lastCheckStartedAt: "2026-11-06T11:00:00.000Z",
      lastCheckCompletedAt: "2026-11-06T11:00:01.000Z",
      lastOutcome: "success",
      lastSuccessAt: "2026-11-06T11:00:01.000Z",
      lastHttpStatus: 200,
      lastDurationMs: 100,
      lastParsedCount: 5,
      lastAcceptedCount: 5,
      lastRejectedCount: 0,
      lastRejectionReasons: {},
      lastStoredSourceNames: ["X"],
      lastItemPublishedAt: "2026-11-06T10:00:00.000Z",
      lastError: null,
      consecutiveFailures: 0,
      updatedAt: "2026-11-06T11:00:01.000Z",
    };
    const status = (record: PublicNewsSourceHealthRecord | null, publicArticleCount = 4) =>
      resolveNewsSourceHealthStatus({
        record,
        publicArticleCount,
        now,
        staleAfterMs: 12 * 3_600_000,
        retentionDays: 7,
      });
    assert.deepEqual(status(base), { status: "healthy", statusReason: "ok" });
    assert.deepEqual(status(null), { status: "never_checked", statusReason: "no_telemetry" });
    assert.deepEqual(status({ ...base, lastSuccessAt: "2026-11-05T20:00:00.000Z" }), {
      status: "stale",
      statusReason: "not_checked_recently",
    });
    assert.deepEqual(status({ ...base, lastItemPublishedAt: "2026-10-20T00:00:00.000Z" }), {
      status: "stale",
      statusReason: "feed_not_updating",
    });
    assert.deepEqual(status(base, 0), { status: "failing", statusReason: "no_public_articles" });
    assert.deepEqual(status({ ...base, lastOutcome: "fetch_failed" }), {
      status: "failing",
      statusReason: "fetch_failed",
    });
  });

  it("12. errors are sanitized: fixed messages, no URLs, addresses or stacks", () => {
    const cases: [unknown, string][] = [
      [new ExternalRequestError(503), "http_error"],
      [Object.assign(new Error("This operation was aborted"), { name: "AbortError" }), "timeout"],
      [new TypeError("fetch failed"), "network_error"],
      [new Error("getaddrinfo ENOTFOUND secret.internal.example"), "network_error"],
      [new Error("Blocked resolved IP address."), "blocked_host"],
      [new Error("External response exceeded size limit."), "response_too_large"],
      [new Error("RSS feed URL is not in the approved media registry."), "unapproved_feed"],
      [new Error("Unexpected https://user:token@feeds.example/x?key=secret"), "unknown_error"],
    ];
    for (const [error, code] of cases) {
      const summary = classifySourceFetchError(error);
      assert.equal(summary.code, code);
      assert.doesNotMatch(summary.message, /https?:|token|secret|internal|ENOTFOUND|\bat\s/);
    }
  });
});

describe("RSS-HEALTH-01 — Admin authorization and contract", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    const app = express();
    app.use((req, _res, next) => {
      const user = req.header("x-test-user");
      if (user) {
        (req as unknown as { auth: { id: string } }).auth = { id: user };
      }
      next();
    });
    app.use("/api/v1/admin/media-resources", adminMediaResourcesRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const get = async (user?: string) => {
    mock.restoreAll();
    const res = await fetch(`${baseUrl}/api/v1/admin/media-resources/news-health`, {
      headers: user ? { "x-test-user": user } : {},
    });
    const body = await res.json();
    installNetworkMocks();
    return { status: res.status, body };
  };

  it("13. non-admin is rejected by the existing admin check", async () => {
    await assert.rejects(
      listAdminNewsSourceHealth({ actorUserId: "member-user" }),
      AdministrationForbiddenError,
    );
    // Route level: the existing middleware may resolve a bootstrap identity in tests,
    // so authorization is driven by the existing admin check (override).
    setMediaResourceAdminAssertOverrideForTests(async () => {
      throw new AdministrationForbiddenError("Administrator access is required.");
    });
    for (const user of [undefined, "member-user"]) {
      const response = await get(user);
      assert.ok([401, 403].includes(response.status), String(response.status));
      assert.equal(response.body.data, null);
    }
  });

  it("14. admin gets the bounded contract without RSS URLs or stacks", async () => {
    await refreshPublicNews();
    setMediaResourceAdminAssertOverrideForTests(async (userId) => ({
      userId,
      memberId: "admin-member",
    }));
    const { status, body } = await get("admin-user");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data.items));
    const serialized = JSON.stringify(body);
    for (const forbidden of [FEEDS.ukrinform, "/rss", "rssUrl", "stack", "    at "]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    const item = body.data.items.find(
      (entry: { mediaResourceId: string }) => entry.mediaResourceId === "ukrinform",
    );
    assert.deepEqual(Object.keys(item).sort(), [
      "active",
      "consecutiveFailures",
      "countryCode",
      "lastAcceptedCount",
      "lastCheckCompletedAt",
      "lastDurationMs",
      "lastError",
      "lastHttpStatus",
      "lastItemPublishedAt",
      "lastOutcome",
      "lastParsedCount",
      "lastRejectedCount",
      "lastRejectionReasons",
      "lastStoredSourceNames",
      "lastSuccessAt",
      "mediaResourceId",
      "name",
      "providerId",
      "publicArticleCount",
      "publicArticleCountCapped",
      "scopeType",
      "status",
      "statusReason",
    ]);
  });
});
