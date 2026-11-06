/**
 * RSS-SOURCE-02C — Admin RSS/Atom discovery and confirmation, and tracking-pixel
 * rejection in RSS image extraction. Real services; DNS and transport are mocked.
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
import { gzipSync } from "node:zlib";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";

import express from "express";
import type { MediaResource } from "@hu/types";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import adminMediaResourcesRouter from "../../../src/modules/media-resources/admin-media-resources.routes.js";
import {
  MediaResourceConflictError,
  MediaResourceValidationError,
} from "../../../src/modules/media-resources/media-resource.errors.js";
import {
  confirmAdminNewsSourceFeed,
  createAdminMediaResource,
  discoverAdminNewsSourceFeeds,
  ensureMediaResourcesSeededOnce,
  getAdminMediaResource,
  setMediaResourceAdminAssertOverrideForTests,
  updateAdminMediaResource,
} from "../../../src/modules/media-resources/media-resource.service.js";
import {
  fromMediaResourceMongoDocument,
  toMediaResourceMongoDocument,
} from "../../../src/modules/media-resources/persistence/media-resource.mongo-document.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import {
  classifyFeedForSection,
  extractAdvertisedFeedLinks,
  NEWS_FEED_DISCOVERY_RATE_LIMIT,
  NewsFeedDiscoveryRateLimitError,
  resetNewsFeedDiscoveryLimitsForTests,
  setNewsFeedDiscoveryTimeoutsForTests,
} from "../../../src/modules/public-news/public-news-feed-discovery.js";
import {
  isTrackingImageUrl,
  sanitizePublicNewsImageUrl,
} from "../../../src/modules/public-news/public-news-image-url.js";
import { resetPublicNewsRefreshLeaseForTests } from "../../../src/modules/public-news/public-news-refresh-lease.js";
import {
  listPublicNewsSourceHealth,
  resetPublicNewsSourceHealthForTests,
} from "../../../src/modules/public-news/public-news-source-health.repository.js";
import { refreshApprovedNewsSourcesFromMediaResources } from "../../../src/modules/public-news/public-news.config.js";
import {
  setExternalFetchRetrySleepForTests,
  setExternalHttpTransportForTests,
  type ExternalHttpRequest,
} from "../../../src/modules/public-news/public-news.fetch.js";
import { toPublicNewsArticleItem } from "../../../src/modules/public-news/public-news.normalize.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
} from "../../../src/modules/public-news/public-news.repository.js";
import { parseRssOrAtomFeed } from "../../../src/modules/public-news/public-news.rss-parser.js";
import { refreshPublicNews } from "../../../src/modules/public-news/public-news.service.js";
import {
  type FakeExternalResponse,
  toExternalHttpResponse,
} from "../../helpers/fake-external-http.js";

const SITE = "https://news.example.org";
const HOME = `${SITE}/`;
const PUBLIC_IP = "93.184.216.34";
const TIMESTAMP = "2026-10-01T00:00:00.000Z";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

function rss(title: string, links: { url: string; at: Date }[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>${links
    .map(
      (link, n) =>
        `<item><title>Discovery article number ${n}</title><link>${link.url}</link><pubDate>${link.at.toUTCString()}</pubDate><description>Summary ${n}.</description></item>`,
    )
    .join("")}</channel></rss>`;
}

function atom(title: string, links: { url: string; at: Date }[]): string {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${title}</title>${links
    .map(
      (link, n) =>
        `<entry><title>Atom article number ${n}</title><link rel="alternate" href="${link.url}"/><id>${link.url}</id><updated>${link.at.toISOString()}</updated><summary>Summary ${n}.</summary></entry>`,
    )
    .join("")}</feed>`;
}

const html = (head: string) =>
  `<!doctype html><html><head><title>News</title>${head}</head><body>Home</body></html>`;
const articles = (count: number, at: Date, host = "news.example.org") =>
  Array.from({ length: count }, (_, n) => ({
    url: `https://${host}/world/2026/11/06/story-number-${n}`,
    at,
  }));

let responses: Record<
  string,
  (request: ExternalHttpRequest) => FakeExternalResponse | Promise<FakeExternalResponse>
> = {};
let requested: string[] = [];
let dnsAnswers: (host: string) => { address: string; family: number }[] = () => [
  { address: PUBLIC_IP, family: 4 },
];

function newsSource(overrides: Partial<MediaResource> = {}): MediaResource {
  return {
    id: "news-example",
    resourceType: "NEWS_SOURCE",
    scopeType: "COUNTRY",
    countryCode: "UA",
    name: "Example News",
    logoLabel: "EN",
    logoUrl: null,
    websiteUrl: SITE,
    rssUrl: `${SITE}/old-feed.xml`,
    categoryId: null,
    description: "Admin description",
    secondaryText: null,
    language: "uk",
    providerId: null,
    articleDomains: ["cdn-news.example.net"],
    active: true,
    sortOrder: 7,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

async function seed(resource: MediaResource): Promise<void> {
  resetMediaResourcesMemoryForTests();
  upsertMediaResourceMemory(resource);
  await refreshApprovedNewsSourcesFromMediaResources();
}

const admin = async (userId: string) => {
  if (userId !== "admin-user" && userId !== "admin-2") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId, memberId: `${userId}-member` };
};

before(async () => {
  setMediaResourceForceMemoryForTests(true);
  setLanguageRegistryForceMemoryForTests(true);
  setPlpAutoBuildWorkForceMemoryForTests(true);
  setPublishedLocalizationPersistenceModeForTests("memory");
  await ensureMediaResourcesSeededOnce();
});

beforeEach(async () => {
  responses = {};
  requested = [];
  dnsAnswers = () => [{ address: PUBLIC_IP, family: 4 }];
  mock.method(dnsPromises, "lookup", async (host: string) => dnsAnswers(host));
  setExternalHttpTransportForTests(async (request) => {
    requested.push(request.url.toString());
    const respond = responses[request.url.toString()];
    if (!respond) {
      return toExternalHttpResponse({ status: 404, body: "Not found" });
    }
    return toExternalHttpResponse(await respond(request));
  });
  setExternalFetchRetrySleepForTests(async () => undefined);
  setNewsFeedDiscoveryTimeoutsForTests({ websiteMs: 80, feedMs: 80 });
  resetNewsFeedDiscoveryLimitsForTests();
  resetPublicNewsMemoryStoreForTests();
  resetPublicNewsSourceHealthForTests();
  resetPublicNewsRefreshLeaseForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPublishedLocalizationPersistenceForTests();
  setMediaResourceAdminAssertOverrideForTests(admin);
  await seed(newsSource());
});

afterEach(() => {
  mock.restoreAll();
  setExternalHttpTransportForTests(null);
  setExternalFetchRetrySleepForTests(null);
  setNewsFeedDiscoveryTimeoutsForTests(null);
  setMediaResourceAdminAssertOverrideForTests(null);
});

after(() => {
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  setMediaResourceForceMemoryForTests(false);
  setLanguageRegistryForceMemoryForTests(false);
  resetLanguageRegistryStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
});

const discover = (
  input: { websiteUrl?: string; newsSectionUrl?: string | null; mediaResourceId?: string },
  actorUserId = "admin-user",
) => discoverAdminNewsSourceFeeds({ actorUserId, ...input });

describe("RSS-SOURCE-02C — discovery", () => {
  it("1. official RSS: advertised feed verified; comments feed listed but never fetched", async () => {
    responses[HOME] = () => ({
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html(
        `<link rel="alternate" type="application/rss+xml" title="Example News &raquo; Feed" href="/feed/">` +
          `<link rel="alternate" type="application/rss+xml" title="Example News &raquo; Comments Feed" href="/comments/feed/">`,
      ),
    });
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example News", articles(4, hoursAgo(2))),
    });

    const result = await discover({ websiteUrl: SITE });
    assert.equal(result.status, "found");
    assert.equal(result.recommendedFeedUrl, `${SITE}/feed/`);
    const [main, comments] = result.candidates;
    assert.deepEqual(
      [main?.valid, main?.format, main?.title, main?.sampleArticleCount, main?.recommended],
      [true, "rss", "Example News", 4, true],
    );
    assert.ok(main?.latestPublishedAt);
    assert.deepEqual([comments?.reason, comments?.valid], ["comments_feed", false]);
    assert.ok(!requested.includes(`${SITE}/comments/feed/`), "comments feed is not fetched");
    assert.deepEqual(
      requested.filter((url) => !url.endsWith("old-feed.xml")),
      [HOME, `${SITE}/feed/`],
      "only the website and its advertised feed are fetched",
    );
  });

  it("2. official Atom, relative link resolved against the redirected page URL", async () => {
    await seed(
      newsSource({ websiteUrl: "https://example.org", rssUrl: null, articleDomains: null }),
    );
    responses["https://example.org/"] = () => ({
      status: 301,
      headers: { Location: "https://www.example.org/en/" },
    });
    responses["https://www.example.org/en/"] = () => ({
      status: 200,
      body: html(`<link href='atom.xml' type='application/atom+xml' rel='alternate'>`),
    });
    responses["https://www.example.org/en/atom.xml"] = () => ({
      status: 200,
      body: atom("Example Atom", articles(2, hoursAgo(1), "www.example.org")),
    });
    const result = await discover({ mediaResourceId: "news-example" });
    assert.equal(result.status, "found");
    assert.equal(result.recommendedFeedUrl, "https://www.example.org/en/atom.xml");
    assert.deepEqual(
      [result.candidates[0]?.format, result.candidates[0]?.sampleArticleCount],
      ["atom", 2],
    );
    assert.equal(result.current, null);
  });

  it("3. multiple feeds: fresh valid feed preferred; broken, off-site, insecure feeds explained", async () => {
    responses[HOME] = () => ({
      status: 200,
      body: html(
        [
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/broken.xml">`,
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/stale.xml">`,
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/offsite.xml">`,
          `<link rel="alternate" type="application/rss+xml" href="http://news.example.org/insecure.xml">`,
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/fresh.xml">`,
        ].join(""),
      ),
    });
    responses[`${SITE}/stale.xml`] = () => ({
      status: 200,
      body: rss("Stale", articles(3, hoursAgo(24 * 60))),
    });
    responses[`${SITE}/offsite.xml`] = () => ({
      status: 200,
      body: rss("Offsite", articles(3, hoursAgo(1), "unrelated.example.com")),
    });
    responses[`${SITE}/fresh.xml`] = () => ({
      status: 200,
      body: rss("Fresh", articles(5, hoursAgo(1))),
    });

    const result = await discover({ websiteUrl: SITE });
    assert.equal(result.recommendedFeedUrl, `${SITE}/fresh.xml`);
    const byUrl = Object.fromEntries(
      result.candidates.map((candidate) => [candidate.feedUrl, candidate]),
    );
    assert.deepEqual(
      [byUrl[`${SITE}/broken.xml`]?.reason, byUrl[`${SITE}/broken.xml`]?.httpStatus],
      ["http_error", 404],
    );
    assert.equal(byUrl[`${SITE}/stale.xml`]?.valid, true);
    assert.equal(byUrl[`${SITE}/offsite.xml`]?.reason, "no_valid_articles");
    assert.equal(byUrl["http://news.example.org/insecure.xml"]?.reason, "not_https");
    assert.ok(!requested.includes("http://news.example.org/insecure.xml"));
    assert.deepEqual(
      result.candidates.slice(0, 2).map((candidate) => candidate.feedUrl),
      [`${SITE}/fresh.xml`, `${SITE}/stale.xml`],
    );
  });

  it("4. existing source with a broken RSS URL: current reported broken, working feed found", async () => {
    responses[HOME] = () => ({
      status: 200,
      body: html(`<link rel="alternate" type="application/rss+xml" href="/rss/news.xml">`),
    });
    responses[`${SITE}/rss/news.xml`] = () => ({
      status: 200,
      body: rss("Example", articles(3, hoursAgo(3))),
    });
    const result = await discover({ mediaResourceId: "news-example" });
    assert.equal(result.status, "found");
    assert.deepEqual(
      [result.current?.feedUrl, result.current?.valid, result.current?.reason],
      [`${SITE}/old-feed.xml`, false, "http_error"],
    );
  });

  it("5. no feed advertised, and an unreachable website, are reported safely", async () => {
    responses[HOME] = () => ({ status: 200, body: html(`<link rel="stylesheet" href="/a.css">`) });
    assert.equal((await discover({ websiteUrl: SITE })).status, "no_feed_advertised");

    dnsAnswers = () => [{ address: "10.0.0.8", family: 4 }];
    const unreachable = await discover({ websiteUrl: "https://intranet-news.example.org" });
    assert.equal(unreachable.status, "website_unreachable");
    assert.match(unreachable.message, /website host is not allowed/);
    assert.doesNotMatch(JSON.stringify(unreachable), /10\.0\.0\.8/);
  });

  it("6. invalid or malicious website URLs are refused before any request", async () => {
    for (const websiteUrl of [
      "http://news.example.org",
      "javascript:alert(1)",
      "https://user:pw@news.example.org",
      "not a url",
      "",
    ]) {
      await assert.rejects(discover({ websiteUrl }), MediaResourceValidationError, websiteUrl);
    }
    assert.equal(requested.length, 0);
  });

  it("7. private targets: website or feed redirects to private addresses are blocked", async () => {
    dnsAnswers = (host) =>
      host === "metadata.internal.example"
        ? [{ address: "169.254.169.254", family: 4 }]
        : [{ address: PUBLIC_IP, family: 4 }];
    responses[HOME] = () => ({
      status: 200,
      body: html(
        `<link rel="alternate" type="application/rss+xml" href="https://metadata.internal.example/latest">` +
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/redirecting.xml">`,
      ),
    });
    responses[`${SITE}/redirecting.xml`] = () => ({
      status: 302,
      headers: { Location: "http://127.0.0.1/feed" },
    });
    const result = await discover({ websiteUrl: SITE });
    assert.equal(result.status, "no_valid_feed");
    assert.ok(result.candidates.every((candidate) => candidate.reason === "blocked_host"));
    assert.ok(
      !requested.some((url) => url.includes("127.0.0.1") || url.includes("metadata.internal")),
    );

    responses[HOME] = () => ({
      status: 302,
      headers: { Location: "https://metadata.internal.example/" },
    });
    assert.equal((await discover({ websiteUrl: SITE })).status, "website_unreachable");
  });

  it("8. timeouts and oversized responses are bounded and explained", async () => {
    responses[HOME] = () => ({
      status: 200,
      body: html(
        `<link rel="alternate" type="application/rss+xml" href="${SITE}/slow.xml">` +
          `<link rel="alternate" type="application/rss+xml" href="${SITE}/huge.xml">`,
      ),
    });
    responses[`${SITE}/slow.xml`] = () => new Promise(() => undefined);
    responses[`${SITE}/huge.xml`] = () => ({
      status: 200,
      headers: { "Content-Length": String(50 * 1024 * 1024) },
    });
    const started = Date.now();
    const result = await discover({ websiteUrl: SITE });
    assert.ok(Date.now() - started < 2_000);
    const reasons = Object.fromEntries(
      result.candidates.map((candidate) => [candidate.feedUrl, candidate.reason]),
    );
    assert.deepEqual(reasons, {
      [`${SITE}/slow.xml`]: "timeout",
      [`${SITE}/huge.xml`]: "response_too_large",
    });

    responses[HOME] = () => new Promise(() => undefined);
    assert.equal((await discover({ websiteUrl: SITE })).status, "website_unreachable");
  });

  it("8b. large homepages are read up to 1 MB (plain or compressed); bombs stay bounded", async () => {
    const head = html(`<link rel="alternate" type="application/rss+xml" href="/feed/">`);
    const big = `${head}${"<p>filler</p>".repeat(250_000)}`;
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example", articles(2, hoursAgo(1))),
    });
    responses[HOME] = () => ({
      status: 200,
      headers: { "Content-Length": String(big.length) },
      body: big,
    });
    assert.equal((await discover({ websiteUrl: SITE })).status, "found");

    responses[HOME] = () => ({
      status: 200,
      headers: { "Content-Encoding": "gzip" },
      body: gzipSync(Buffer.from(big)),
    });
    assert.equal((await discover({ websiteUrl: SITE })).status, "found");

    const bomb = gzipSync(Buffer.alloc(50 * 1024 * 1024, 0x20));
    responses[HOME] = () => ({ status: 200, headers: { "Content-Encoding": "gzip" }, body: bomb });
    const memoryBefore = process.memoryUsage().heapUsed;
    assert.equal((await discover({ websiteUrl: SITE })).status, "no_feed_advertised");
    assert.ok(process.memoryUsage().heapUsed - memoryBefore < 40 * 1024 * 1024);
  });

  it("9. per-Admin rate limit and global concurrency limit", async () => {
    responses[HOME] = () => ({ status: 200, body: html("") });
    for (let n = 0; n < NEWS_FEED_DISCOVERY_RATE_LIMIT.maxRequests; n += 1) {
      await discover({ websiteUrl: SITE });
    }
    await assert.rejects(discover({ websiteUrl: SITE }), NewsFeedDiscoveryRateLimitError);
    assert.equal((await discover({ websiteUrl: SITE }, "admin-2")).status, "no_feed_advertised");

    resetNewsFeedDiscoveryLimitsForTests();
    let releaseSlow!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    setNewsFeedDiscoveryTimeoutsForTests({ websiteMs: 5_000, feedMs: 5_000 });
    responses[HOME] = async () => {
      await gate;
      return { status: 200, body: html("") };
    };
    const running = [discover({ websiteUrl: SITE }), discover({ websiteUrl: SITE }, "admin-2")];
    await assert.rejects(discover({ websiteUrl: SITE }), /busy/);
    releaseSlow();
    await Promise.all(running);
  });

  it("10. discovery is read-only and never touches source health; non-admins are refused", async () => {
    responses[`${SITE}/old-feed.xml`] = () => ({
      status: 200,
      body: rss("Old", articles(2, hoursAgo(1))),
    });
    await refreshPublicNews();
    const healthBefore = (await listPublicNewsSourceHealth(["news-example"])).get("news-example");
    assert.ok(healthBefore);
    const resourceBefore = await getAdminMediaResource({
      actorUserId: "admin-user",
      id: "news-example",
      resourceType: "NEWS_SOURCE",
    });

    responses[HOME] = () => ({ status: 503 });
    await discover({ mediaResourceId: "news-example" });
    assert.deepEqual(
      (await listPublicNewsSourceHealth(["news-example"])).get("news-example"),
      healthBefore,
    );
    assert.deepEqual(
      await getAdminMediaResource({
        actorUserId: "admin-user",
        id: "news-example",
        resourceType: "NEWS_SOURCE",
      }),
      resourceBefore,
      "cancel = no confirm: nothing changed",
    );
    await assert.rejects(
      discover({ websiteUrl: SITE }, "member-user"),
      AdministrationForbiddenError,
    );
  });
});

describe("RSS-SOURCE-02C — confirmation", () => {
  const confirm = (input: {
    feedUrl: string;
    expectedCurrentRssUrl: string | null;
    replaceWorkingFeed?: boolean;
  }) => confirmAdminNewsSourceFeed({ actorUserId: "admin-user", id: "news-example", ...input });

  it("11. confirming a verified feed replaces a broken RSS URL and preserves every other setting", async () => {
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example", articles(3, hoursAgo(1))),
    });
    const before = await getAdminMediaResource({
      actorUserId: "admin-user",
      id: "news-example",
      resourceType: "NEWS_SOURCE",
    });
    const { resource, candidate } = await confirm({
      feedUrl: `${SITE}/feed/`,
      expectedCurrentRssUrl: `${SITE}/old-feed.xml`,
    });
    assert.equal(candidate.valid, true);
    assert.equal(resource.rssUrl, `${SITE}/feed/`);
    const { rssUrl: _a, updatedAt: _b, ...rest } = resource;
    const { rssUrl: _c, updatedAt: _d, ...restBefore } = before;
    assert.deepEqual(rest, restBefore, "identity, country, language, articleDomains, state kept");
    assert.equal(
      (await findActivePublicNewsRecords({ limit: 10 })).length,
      0,
      "no refresh was run",
    );
    assert.equal((await listPublicNewsSourceHealth(["news-example"])).size, 0, "no health written");
  });

  it("12. a working RSS URL is never replaced silently", async () => {
    responses[`${SITE}/old-feed.xml`] = () => ({
      status: 200,
      body: rss("Old", articles(2, hoursAgo(1))),
    });
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("New", articles(3, hoursAgo(1))),
    });
    await assert.rejects(
      confirm({ feedUrl: `${SITE}/feed/`, expectedCurrentRssUrl: `${SITE}/old-feed.xml` }),
      (error) => error instanceof MediaResourceConflictError && /working/.test(error.message),
    );
    assert.equal(
      (
        await getAdminMediaResource({
          actorUserId: "admin-user",
          id: "news-example",
          resourceType: "NEWS_SOURCE",
        })
      ).rssUrl,
      `${SITE}/old-feed.xml`,
    );
    const replaced = await confirm({
      feedUrl: `${SITE}/feed/`,
      expectedCurrentRssUrl: `${SITE}/old-feed.xml`,
      replaceWorkingFeed: true,
    });
    assert.equal(replaced.resource.rssUrl, `${SITE}/feed/`);
  });

  it("13. stale discovery, unverifiable feeds and insecure URLs are refused without changes", async () => {
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("New", articles(3, hoursAgo(1))),
    });
    await assert.rejects(
      confirm({ feedUrl: `${SITE}/feed/`, expectedCurrentRssUrl: `${SITE}/something-else.xml` }),
      /changed since discovery/,
    );
    await assert.rejects(
      confirm({ feedUrl: `${SITE}/missing.xml`, expectedCurrentRssUrl: `${SITE}/old-feed.xml` }),
      (error) =>
        error instanceof MediaResourceValidationError &&
        /could not be verified/.test(error.message),
    );
    await assert.rejects(
      confirm({
        feedUrl: "http://news.example.org/feed/",
        expectedCurrentRssUrl: `${SITE}/old-feed.xml`,
      }),
      MediaResourceValidationError,
    );
    assert.equal(
      (
        await getAdminMediaResource({
          actorUserId: "admin-user",
          id: "news-example",
          resourceType: "NEWS_SOURCE",
        })
      ).rssUrl,
      `${SITE}/old-feed.xml`,
    );
  });
});

describe("RSS-SOURCE-02C — Admin routes", () => {
  let server: Server;
  let baseUrl = "";

  before(async () => {
    const app = express();
    app.use(express.json());
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

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("14. discovery route returns the result, 429 when rate limited, 400 for invalid input", async () => {
    // The auth middleware may resolve a bootstrap identity in tests; authorization is
    // driven by the existing admin check (override).
    setMediaResourceAdminAssertOverrideForTests(async (userId) => ({ userId, memberId: "m" }));
    responses[HOME] = () => ({ status: 200, body: html("") });
    const post = async (body: unknown) => {
      const res = await fetch(
        `${baseUrl}/api/v1/admin/media-resources/news-sources/discover-feed`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-test-user": "admin-user" },
          body: JSON.stringify(body),
        },
      );
      return {
        status: res.status,
        body: (await res.json()) as { data: { status?: string } | null; message: string },
      };
    };
    const ok = await post({ websiteUrl: SITE });
    assert.deepEqual([ok.status, ok.body.data?.status], [200, "no_feed_advertised"]);
    assert.equal((await post({ websiteUrl: "http://news.example.org" })).status, 400);
    for (let n = 1; n < NEWS_FEED_DISCOVERY_RATE_LIMIT.maxRequests; n += 1) {
      await post({ websiteUrl: SITE });
    }
    const limited = await post({ websiteUrl: SITE });
    assert.equal(limited.status, 429);
    assert.match(limited.body.message, /limit reached/);
  });
});

describe("RSS-SOURCE-02C — tracking-pixel rejection", () => {
  it("15. tracking images rejected; legitimate news photos preserved", () => {
    for (const tracker of [
      "https://counter.theconversation.com/content/289777/count.gif",
      "https://stats.example.org/count.gif",
      "https://cdn.example.org/img/counter.gif",
      "https://pixel.wp.com/g.gif?blog=1",
      "https://cdn.example.org/1x1/pixel.png",
      "https://cdn.example.org/assets/1x1.gif",
      "https://cdn.example.org/spacer.gif",
      "https://feeds.feedburner.com/~r/example/~4/abc",
      "https://cdn.example.org/rss-pixel.png",
    ]) {
      assert.equal(isTrackingImageUrl(tracker), true, tracker);
      assert.equal(sanitizePublicNewsImageUrl(tracker), undefined, tracker);
    }
    for (const photo of [
      "https://i.guim.co.uk/img/media/abc/master/counter-terrorism-police.jpg?width=700",
      "https://cdn.example.org/2026/11/google-pixel-10-review.jpg",
      "https://images.theconversation.com/files/770403/original/file.jpg?w=1050",
      "https://static.ukrinform.com/photos/2026_03/thumb_files/630_360_1773933311-402.jpeg",
      "https://cdn.example.org/charts/vote-count.png",
    ]) {
      assert.equal(isTrackingImageUrl(photo), false, photo);
      assert.equal(sanitizePublicNewsImageUrl(photo), photo, photo);
    }
  });

  it("16. extraction skips beacons (URL or declared 1x1) and keeps the real article image", () => {
    const feed = (content: string) =>
      `<rss><channel><item><title>Pixel test article title</title><link>https://theconversation.com/a-story-12345</link><content:encoded><![CDATA[${content}]]></content:encoded></item></channel></rss>`;
    const imageOf = (content: string) =>
      parseRssOrAtomFeed(feed(content), "https://theconversation.com/feed")[0]?.imageUrl;
    assert.equal(
      imageOf(
        '<img src="https://counter.theconversation.com/content/289777/count.gif" alt="The Conversation" width="1" height="1"><img src="https://images.theconversation.com/files/1/original.jpg">',
      ),
      "https://images.theconversation.com/files/1/original.jpg",
    );
    assert.equal(
      imageOf('<img src="https://ads.example.org/b.png" width="1" height="1"><p>No photo</p>'),
      undefined,
    );
    assert.equal(
      imageOf('<img src="https://counter.theconversation.com/content/289777/count.gif">'),
      undefined,
      "a beacon alone yields no image (card fallback)",
    );
    assert.equal(
      parseRssOrAtomFeed(
        `<rss><channel><item><title>Media pixel test title</title><link>https://example.org/news/a-story-1</link><media:thumbnail url="https://pixel.example.org/t.gif"/><enclosure type="image/jpeg" url="https://cdn.example.org/photo.jpg"/></item></channel></rss>`,
        "https://example.org/feed",
      )[0]?.imageUrl,
      "https://cdn.example.org/photo.jpg",
    );
  });

  it("17. a stored tracking image (legacy) is not served by the public API", () => {
    const item = toPublicNewsArticleItem({
      id: "news-legacy",
      provider: "rss",
      sourceName: "The Conversation",
      title: "Legacy",
      summary: "Legacy",
      articleUrl: "https://theconversation.com/a-story-12345",
      normalizedArticleUrl: "https://theconversation.com/a-story-12345",
      imageUrl: "https://counter.theconversation.com/content/289777/count.gif",
      publishedAt: TIMESTAMP,
      fetchedAt: TIMESTAMP,
      expiresAt: TIMESTAMP,
      language: "en",
      status: "active",
      verificationStatus: "external-source",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    assert.equal(item.imageUrl, undefined);
  });

  it("18. advertised feed link extraction handles quoting, entities and duplicates", () => {
    const links = extractAdvertisedFeedLinks(
      `<link rel="alternate" type="application/rss+xml" href="/feed?a=1&amp;b=2"><LINK REL="Alternate Feed" TYPE="application/atom+xml; charset=utf-8" HREF=https://x.example.org/atom>` +
        `<link rel="alternate" type="application/rss+xml" href="/feed?a=1&amp;b=2#frag"><link rel="alternate" type="text/html" href="/en">`,
      "https://x.example.org/news/",
    );
    assert.deepEqual(
      links.map((link) => link.url),
      ["https://x.example.org/feed?a=1&b=2", "https://x.example.org/atom"],
    );
  });
});

describe("RSS-SOURCE-02C.1 — news section discovery", () => {
  const SECTION = `${SITE}/world/`;
  const sectionPage = (head: string, title = "World news | Example News") =>
    `<!doctype html><html><head><title>${title}</title>${head}</head><body>World</body></html>`;
  const worldArticles = (count: number) =>
    Array.from({ length: count }, (_, n) => ({
      url: `${SITE}/world/2026/11/06/world-story-${n}`,
      at: hoursAgo(1),
    }));
  const mixedArticles = (inWorld: number, elsewhere: number) => [
    ...worldArticles(inWorld),
    ...Array.from({ length: elsewhere }, (_, n) => ({
      url: `${SITE}/sport/2026/11/06/sport-story-${n}`,
      at: hoursAgo(2),
    })),
  ];
  const withSection = (overrides: Partial<MediaResource> = {}) =>
    newsSource({ newsSectionUrl: SECTION, ...overrides });

  it("19. section-specific discovery reads the section page only and finds a section match", async () => {
    await seed(withSection());
    responses[SECTION] = () => ({
      status: 200,
      body: sectionPage(
        `<link rel="alternate" type="application/rss+xml" title="World" href="/world/rss">`,
      ),
    });
    responses[`${SITE}/world/rss`] = () => ({
      status: 200,
      body: rss("World news", worldArticles(6)),
    });
    responses[HOME] = () => ({
      status: 200,
      body: html(`<link rel="alternate" type="application/rss+xml" href="/feed/">`),
    });

    const result = await discover({ mediaResourceId: "news-example" });
    assert.deepEqual(
      [result.status, result.newsSectionUrl, result.discoveryPageUrl, result.recommendedFeedUrl],
      ["found", SECTION, SECTION, `${SITE}/world/rss`],
    );
    assert.match(result.message, /Section feed found/);
    const [best] = result.candidates;
    assert.equal(best?.sectionMatch, "section_match");
    assert.ok(best?.sectionEvidence.some((line) => /6 of 6 sample articles/.test(line)));
    assert.equal(best?.sampleArticleUrls.length, 3);
    assert.ok(!requested.includes(HOME), "the homepage is not read");
  });

  it("20. a section page without a feed reports that; no fallback to the homepage", async () => {
    await seed(withSection());
    responses[SECTION] = () => ({ status: 200, body: sectionPage("") });
    responses[HOME] = () => ({
      status: 200,
      body: html(`<link rel="alternate" type="application/rss+xml" href="/feed/">`),
    });
    const result = await discover({ mediaResourceId: "news-example" });
    assert.equal(result.status, "no_feed_advertised");
    assert.match(
      result.message,
      /No section-specific feed was found; the main website was not checked\./,
    );
    assert.deepEqual(result.candidates, []);
    assert.ok(!requested.includes(HOME));
    assert.ok(!requested.includes(`${SITE}/feed/`));
  });

  it("21. a general site feed advertised on the section page is classified general_feed", async () => {
    await seed(withSection());
    responses[SECTION] = () => ({
      status: 200,
      body: sectionPage(
        `<link rel="alternate" type="application/rss+xml" title="Example News" href="/feed/">`,
      ),
    });
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example News", mixedArticles(1, 9)),
    });
    const result = await discover({ mediaResourceId: "news-example" });
    assert.equal(result.status, "found");
    assert.equal(result.candidates[0]?.sectionMatch, "general_feed");
    assert.match(
      result.message,
      /none is confirmed as specific to this section\. Unrelated news may appear/,
    );
  });

  it("22. uncertain: one signal only, or titles that the sample articles contradict", () => {
    const base = { newsSectionUrl: SECTION, sectionPageTitle: "World news" };
    const oneSignal = classifyFeedForSection({
      ...base,
      feedUrl: `${SITE}/rss/world.xml`,
      feedTitles: ["Example News"],
      articleUrls: mixedArticles(4, 6).map((entry) => entry.url),
    });
    assert.equal(oneSignal.sectionMatch, "uncertain");
    const contradicted = classifyFeedForSection({
      ...base,
      feedUrl: `${SITE}/world/rss`,
      feedTitles: ["World news"],
      articleUrls: mixedArticles(0, 10).map((entry) => entry.url),
    });
    assert.equal(
      contradicted.sectionMatch,
      "uncertain",
      "two signals but 0 of 10 articles in section",
    );
    const generic = classifyFeedForSection({
      newsSectionUrl: `${SITE}/news/`,
      sectionPageTitle: null,
      feedUrl: `${SITE}/news/rss`,
      feedTitles: ["News"],
      articleUrls: worldArticles(5).map((entry) => entry.url),
    });
    assert.equal(generic.sectionMatch, "uncertain", "a generic /news/ section cannot be confirmed");
    const ukrainian = classifyFeedForSection({
      newsSectionUrl: "https://www.pravda.com.ua/rubric-politics/",
      sectionPageTitle: "Політика",
      feedUrl: "https://www.pravda.com.ua/rss/view_politics/",
      feedTitles: ["Українська правда — Політика"],
      articleUrls: ["https://www.pravda.com.ua/news/2026/11/06/7512345/"],
    });
    assert.equal(ukrainian.sectionMatch, "section_match", "path and Cyrillic title both match");

    const heading = classifyFeedForSection({
      newsSectionUrl: "https://www.theguardian.com/uk-news",
      sectionPageTitle: "Latest UK news",
      feedUrl: "https://www.theguardian.com/uk-news/rss",
      feedTitles: ["UK news | The Guardian"],
      articleUrls: [
        "https://www.theguardian.com/uk-news/2026/nov/06/a",
        "https://www.theguardian.com/politics/2026/nov/06/b",
      ],
    });
    assert.equal(
      heading.sectionMatch,
      "section_match",
      "feed title repeats the section page heading",
    );

    const unsectionedUrls = classifyFeedForSection({
      newsSectionUrl: "https://globalnews.ca/politics/",
      sectionPageTitle: "Politics",
      feedUrl: "https://globalnews.ca/category/politics/feed/",
      feedTitles: [": Politics"],
      articleUrls: Array.from(
        { length: 10 },
        (_, n) => `https://globalnews.ca/news/1152${n}/slug-${n}/`,
      ),
    });
    assert.equal(
      unsectionedUrls.sectionMatch,
      "section_match",
      "/news/<id> URLs are not contrary evidence",
    );

    const publisherHeading = classifyFeedForSection({
      newsSectionUrl: "https://kyivindependent.com/tag/politics/",
      sectionPageTitle: "The Kyiv Independent",
      feedUrl: "https://kyivindependent.com/news-archive/rss/",
      feedTitles: ["The Kyiv Independent"],
      articleUrls: Array.from(
        { length: 6 },
        (_, n) => `https://kyivindependent.com/story-number-${n}-headline/`,
      ),
    });
    assert.equal(
      publisherHeading.sectionMatch,
      "general_feed",
      "a publisher-name heading is not section evidence",
    );
  });

  it("23. unrelated, internal and insecure section URLs are rejected before any request", async () => {
    for (const newsSectionUrl of [
      "https://unrelated.example.com/world/",
      "https://news.example.org.evil.example/world/",
      "https://10.0.0.1/world/",
      "https://localhost/world/",
      "http://news.example.org/world/",
      "https://user:pw@news.example.org/world/",
      "https://news.example.org:8443/world/",
    ]) {
      await assert.rejects(
        discover({ websiteUrl: SITE, newsSectionUrl }),
        MediaResourceValidationError,
        newsSectionUrl,
      );
    }
    assert.equal(requested.length, 0);

    const base = {
      actorUserId: "admin-user",
      resourceType: "NEWS_SOURCE" as const,
      scopeType: "COUNTRY" as const,
      countryCode: "UA",
      name: "Section Source",
      logoLabel: "SS",
      websiteUrl: "https://section.example.org",
      rssUrl: "https://section.example.org/rss.xml",
    };
    await assert.rejects(
      createAdminMediaResource({ ...base, newsSectionUrl: "https://elsewhere.example.com/world" }),
      /publisher's website domain/,
    );
    await assert.rejects(
      createAdminMediaResource({
        ...base,
        resourceType: "TRUSTED_MEDIA",
        categoryId: "international-wire-service",
        rssUrl: null,
        newsSectionUrl: "https://section.example.org/world",
      }),
      /only allowed for NEWS_SOURCE/,
    );
    const created = await createAdminMediaResource({
      ...base,
      newsSectionUrl: "https://world.section.example.org/latest#top",
    });
    assert.equal(created.newsSectionUrl, "https://world.section.example.org/latest");
    assert.equal("articleDomains" in created, false, "articleDomains are not broadened");
  });

  it("24. changing the section invalidates earlier discovery results at confirmation", async () => {
    await seed(withSection());
    responses[`${SITE}/world/rss`] = () => ({
      status: 200,
      body: rss("World news", worldArticles(4)),
    });
    await updateAdminMediaResource({
      actorUserId: "admin-user",
      id: "news-example",
      resourceType: "NEWS_SOURCE",
      newsSectionUrl: `${SITE}/politics/`,
    });
    await assert.rejects(
      confirmAdminNewsSourceFeed({
        actorUserId: "admin-user",
        id: "news-example",
        feedUrl: `${SITE}/world/rss`,
        expectedCurrentRssUrl: `${SITE}/old-feed.xml`,
        expectedNewsSectionUrl: SECTION,
      }),
      /News Section URL changed since discovery/,
    );
  });

  it("25. existing sources without a section behave exactly as before", async () => {
    responses[HOME] = () => ({
      status: 200,
      body: html(`<link rel="alternate" type="application/rss+xml" href="/feed/">`),
    });
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example News", articles(3, hoursAgo(1))),
    });
    const result = await discover({ mediaResourceId: "news-example" });
    assert.deepEqual([result.newsSectionUrl, result.discoveryPageUrl], [null, SITE]);
    assert.equal(result.candidates[0]?.sectionMatch, null);
    assert.deepEqual(result.candidates[0]?.sectionEvidence, []);
    assert.match(result.message, /Official feed found/);

    const updated = await updateAdminMediaResource({
      actorUserId: "admin-user",
      id: "news-example",
      resourceType: "NEWS_SOURCE",
      name: "Example News Renamed",
    });
    assert.equal("newsSectionUrl" in updated, false);
    assert.equal("newsSectionUrl" in toMediaResourceMongoDocument(updated), false);
    const withSectionDoc = toMediaResourceMongoDocument(withSection());
    assert.equal(fromMediaResourceMongoDocument(withSectionDoc).newsSectionUrl, SECTION);

    // A form that clears the section discovers the website, even if one is saved.
    await seed(withSection());
    const cleared = await discover({ mediaResourceId: "news-example", newsSectionUrl: "" });
    assert.deepEqual([cleared.newsSectionUrl, cleared.discoveryPageUrl], [null, SITE]);
  });

  it("26. confirmation: section matches confirm directly; others need explicit acceptance; settings kept", async () => {
    await seed(withSection());
    responses[SECTION] = () => ({ status: 200, body: sectionPage("") });
    responses[`${SITE}/world/rss`] = () => ({
      status: 200,
      body: rss("World news", worldArticles(4)),
    });
    responses[`${SITE}/feed/`] = () => ({
      status: 200,
      body: rss("Example News", mixedArticles(1, 9)),
    });
    const confirm = (feedUrl: string, acceptSectionMismatch = false) =>
      confirmAdminNewsSourceFeed({
        actorUserId: "admin-user",
        id: "news-example",
        feedUrl,
        expectedCurrentRssUrl: `${SITE}/old-feed.xml`,
        expectedNewsSectionUrl: SECTION,
        acceptSectionMismatch,
      });

    await assert.rejects(confirm(`${SITE}/feed/`), /not confirmed as specific to the news section/);
    const before = await getAdminMediaResource({
      actorUserId: "admin-user",
      id: "news-example",
      resourceType: "NEWS_SOURCE",
    });
    assert.equal(before.rssUrl, `${SITE}/old-feed.xml`, "nothing saved on refusal (cancel path)");

    const { resource, candidate } = await confirm(`${SITE}/world/rss`);
    assert.equal(candidate.sectionMatch, "section_match");
    const { rssUrl: _r, updatedAt: _u, ...rest } = resource;
    const { rssUrl: _r2, updatedAt: _u2, ...restBefore } = before;
    assert.deepEqual(rest, restBefore, "section, identity, country, language, articleDomains kept");
    assert.equal(resource.newsSectionUrl, SECTION);

    await seed(withSection());
    const accepted = await confirm(`${SITE}/feed/`, true);
    assert.equal(accepted.resource.rssUrl, `${SITE}/feed/`);
    assert.equal(accepted.candidate.sectionMatch, "general_feed");
  });

  it("27. section page redirects to private hosts are blocked; section discovery is rate limited", async () => {
    await seed(withSection());
    dnsAnswers = (host) =>
      host === "metadata.internal.example"
        ? [{ address: "169.254.169.254", family: 4 }]
        : [{ address: PUBLIC_IP, family: 4 }];
    responses[SECTION] = () => ({
      status: 302,
      headers: { Location: "https://metadata.internal.example/" },
    });
    const blocked = await discover({ mediaResourceId: "news-example" });
    assert.equal(blocked.status, "website_unreachable");
    assert.match(
      blocked.message,
      /news section page could not be read.*section page host is not allowed/,
    );
    assert.doesNotMatch(JSON.stringify(blocked), /169\.254/);

    for (let n = 1; n < NEWS_FEED_DISCOVERY_RATE_LIMIT.maxRequests; n += 1) {
      await discover({ mediaResourceId: "news-example" });
    }
    await assert.rejects(
      discover({ mediaResourceId: "news-example" }),
      NewsFeedDiscoveryRateLimitError,
    );
  });
});
