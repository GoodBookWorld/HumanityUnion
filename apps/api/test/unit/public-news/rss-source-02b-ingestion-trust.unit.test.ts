/**
 * RSS-SOURCE-02B — Admin source trust, source identity, HTTP fetch security,
 * ingestion reliability (retry, concurrency, refresh lease) and telemetry accuracy.
 * Real refresh + RSS provider; DNS and transport are mocked (no network).
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
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";

import type { MediaResource, NewsArticleRecord } from "@hu/types";

import { selectCountrySourceNewsArticles } from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
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
import {
  createAdminMediaResource,
  ensureMediaResourcesSeededOnce,
  listAdminNewsSourceHealth,
  setMediaResourceAdminAssertOverrideForTests,
  updateAdminMediaResource,
} from "../../../src/modules/media-resources/media-resource.service.js";
import { MediaResourceValidationError } from "../../../src/modules/media-resources/media-resource.errors.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import {
  fromMediaResourceMongoDocument,
  toMediaResourceMongoDocument,
} from "../../../src/modules/media-resources/persistence/media-resource.mongo-document.js";
import {
  mapWithConcurrency,
  RSS_FETCH_CONCURRENCY,
} from "../../../src/modules/public-news/providers/rss-news.provider.js";
import {
  resetPublicNewsRefreshLeaseForTests,
  tryAcquirePublicNewsRefreshLease,
} from "../../../src/modules/public-news/public-news-refresh-lease.js";
import { classifySourceFetchError } from "../../../src/modules/public-news/public-news-source-health.js";
import {
  listPublicNewsSourceHealth,
  resetPublicNewsSourceHealthForTests,
} from "../../../src/modules/public-news/public-news-source-health.repository.js";
import {
  hostMatchesApprovedDomain,
  normalizeApprovedDomain,
  resolveSourceArticleDomains,
} from "../../../src/modules/public-news/public-news-source-trust.js";
import { refreshApprovedNewsSourcesFromMediaResources } from "../../../src/modules/public-news/public-news.config.js";
import {
  computeRetryDelayMs,
  DEFAULT_FEED_RETRY_POLICY,
  ExternalFetchPolicyError,
  ExternalRequestError,
  fetchExternalDocument,
  fetchExternalDocumentWithRetry,
  isBlockedIpAddress,
  pinnedNodeTransport,
  setExternalFetchRetrySleepForTests,
  setExternalHttpTransportForTests,
  validatePublicArticleUrl,
  type ExternalHttpRequest,
} from "../../../src/modules/public-news/public-news.fetch.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import {
  getScheduledLeaseFollowUpsForTests,
  resolveLeaseFollowUpDelayMs,
  runScheduledRefresh,
  startPublicNewsScheduler,
  stopPublicNewsScheduler,
} from "../../../src/modules/public-news/public-news.scheduler.js";
import {
  publicPresentationChangeCountForTests,
  resetPublicPresentationChangeCountForTests,
} from "../../../src/modules/language/public-presentation-changed.js";
import { selectMediaPlpConsumerNewsArticles } from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
import { setPublicNewsRefreshLeaseFailureForTests } from "../../../src/modules/public-news/public-news-refresh-lease.js";
import {
  listPublicNewsArticles,
  refreshPublicNews,
} from "../../../src/modules/public-news/public-news.service.js";
import {
  type FakeExternalResponse,
  toExternalHttpResponse,
} from "../../helpers/fake-external-http.js";

const TIMESTAMP = "2026-10-01T00:00:00.000Z";
const PUBLIC_IP = "93.184.216.34";
const MB = 1024 * 1024;
const FEEDS = {
  pravda: "https://www.pravda.com.ua/rss/view_news/",
  hromadske: "https://hromadske.ua/rss/news",
  ukrinform: "https://www.ukrinform.net/rss/block-lastnews",
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
    providerId: null,
    active: true,
    sortOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

interface FeedItem {
  url: string;
  title: string;
  publishedAt: Date;
}

function rss(items: FeedItem[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items
    .map(
      (item) =>
        `<item><title>${item.title}</title><link>${item.url}</link><guid>${item.url}</guid><description>Summary for ${item.title} with enough words.</description><pubDate>${item.publishedAt.toUTCString()}</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const item = (url: string, title: string, hours = 1): FeedItem => ({
  url,
  title,
  publishedAt: hoursAgo(hours),
});

const pravdaItems = [
  item("https://www.pravda.com.ua/eng/news/2026/11/04/7512341/", "Pravda approved article one"),
  item("https://www.pravda.com.ua/eng/news/2026/11/04/7512342/", "Pravda approved article two", 2),
];
const maliciousItems = [
  item("https://evil.example/eng/news/2026/11/04/1/", "Unknown domain article"),
  item("https://www.pravda.com.ua.evil.example/eng/news/2026/1/", "Suffix attack article"),
  item("https://evilpravda.com.ua/eng/news/2026/11/04/2/", "Prefix attack article"),
  item("http://10.0.0.1/eng/news/2026/11/04/3/", "Private IP literal article"),
];

let feedResponses: Record<string, (request: ExternalHttpRequest) => FakeExternalResponse> = {};
let transportRequests: ExternalHttpRequest[] = [];
let dnsAnswers: (hostname: string, call: number) => { address: string; family: number }[] = () => [
  { address: PUBLIC_IP, family: 4 },
];
let dnsCalls: string[] = [];
let sleeps: number[] = [];

function installMocks(): void {
  mock.method(dnsPromises, "lookup", async (hostname: string) => {
    dnsCalls.push(hostname);
    return dnsAnswers(hostname, dnsCalls.length);
  });
  setExternalHttpTransportForTests(async (request) => {
    transportRequests.push(request);
    const respond = feedResponses[request.url.toString()];
    if (!respond) {
      throw new TypeError("fetch failed");
    }
    return toExternalHttpResponse(respond(request));
  });
  setExternalFetchRetrySleepForTests(async (ms) => {
    sleeps.push(ms);
  });
}

async function seed(resources: MediaResource[]): Promise<void> {
  resetMediaResourcesMemoryForTests();
  for (const resource of resources) {
    upsertMediaResourceMemory(resource);
  }
  await refreshApprovedNewsSourcesFromMediaResources();
}

function stored(): Promise<NewsArticleRecord[]> {
  return findActivePublicNewsRecords({ limit: 50, language: "en" });
}

async function healthOf(id: string) {
  return (await listPublicNewsSourceHealth([id])).get(id);
}

const admin = async (userId: string) => ({ userId, memberId: "admin-member" });

before(async () => {
  setMediaResourceForceMemoryForTests(true);
  setLanguageRegistryForceMemoryForTests(true);
  setPlpAutoBuildWorkForceMemoryForTests(true);
  setPublishedLocalizationPersistenceModeForTests("memory");
  await ensureMediaResourcesSeededOnce();
});

beforeEach(async () => {
  feedResponses = {
    [FEEDS.pravda]: () => ({ status: 200, body: rss([...pravdaItems, ...maliciousItems]) }),
  };
  transportRequests = [];
  dnsCalls = [];
  sleeps = [];
  dnsAnswers = () => [{ address: PUBLIC_IP, family: 4 }];
  installMocks();
  resetPublicNewsMemoryStoreForTests();
  resetPublicNewsSourceHealthForTests();
  resetPublicNewsRefreshLeaseForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPublishedLocalizationPersistenceForTests();
  setMediaResourceAdminAssertOverrideForTests(admin);
  await seed([newsSource("pravda-ua", "Українська правда", FEEDS.pravda)]);
});

afterEach(() => {
  mock.restoreAll();
  setExternalHttpTransportForTests(null);
  setExternalFetchRetrySleepForTests(null);
  setMediaResourceAdminAssertOverrideForTests(null);
});

after(() => {
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  resetPublicNewsSourceHealthForTests();
  resetPublicNewsRefreshLeaseForTests();
  setMediaResourceForceMemoryForTests(false);
  setLanguageRegistryForceMemoryForTests(false);
  resetLanguageRegistryStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
});

describe("RSS-SOURCE-02B — Admin source trust", () => {
  it("1. Admin-added source outside the static registry produces public articles", async () => {
    const result = await refreshPublicNews();
    assert.equal(result.upserted, 2);
    const articles = await stored();
    assert.deepEqual(
      articles.map((article) => article.articleUrl).sort(),
      pravdaItems.map((entry) => entry.url).sort(),
    );
    assert.ok(articles.every((article) => article.sourceName === "Українська правда"));
    assert.ok(articles.every((article) => article.mediaResourceId === "pravda-ua"));
    const listing = await listPublicNewsArticles({ limit: 6, sources: ["Українська правда"] });
    assert.equal(listing.items.length, 2);
    assert.ok(
      listing.items.every((entry) => !("mediaResourceId" in entry)),
      "public contract unchanged",
    );
  });

  it("2. unknown, look-alike and IP-literal article domains are rejected", async () => {
    await refreshPublicNews();
    const urls = (await stored()).map((article) => article.articleUrl);
    for (const malicious of maliciousItems) {
      assert.ok(!urls.includes(malicious.url), malicious.url);
    }
    const health = await healthOf("pravda-ua");
    assert.deepEqual(health?.lastRejectionReasons, { unapproved_article_domain: 4 });
  });

  it("3. explicitly approved article domains extend trust; subdomains match, substrings never", async () => {
    const sisterItem = item(
      "https://hromadske.radio/news/2026/11/04/radio-story-one",
      "Sister domain story",
    );
    const ownItem = item(
      "https://en.hromadske.ua/posts/2026-11-04-own-domain-story",
      "Own subdomain story",
    );
    feedResponses[FEEDS.hromadske] = () => ({ status: 200, body: rss([sisterItem, ownItem]) });
    await seed([newsSource("hromadske", "Hromadske", FEEDS.hromadske)]);
    await refreshPublicNews();
    assert.deepEqual(
      (await stored()).map((a) => a.articleUrl),
      [ownItem.url],
    );

    await updateAdminMediaResource({
      actorUserId: "admin-user",
      id: "hromadske",
      resourceType: "NEWS_SOURCE",
      articleDomains: ["Hromadske.Radio"],
    });
    await refreshPublicNews();
    assert.deepEqual(
      (await stored()).map((a) => a.articleUrl).sort(),
      [ownItem.url, sisterItem.url].sort(),
    );

    assert.equal(hostMatchesApprovedDomain("news.hromadske.radio", "hromadske.radio"), true);
    assert.equal(hostMatchesApprovedDomain("evilhromadske.radio", "hromadske.radio"), false);
    assert.equal(
      hostMatchesApprovedDomain("hromadske.radio.evil.example", "hromadske.radio"),
      false,
    );
  });

  it("4. registry-linked Admin rows keep their registry domains (backward compatibility)", () => {
    const domains = resolveSourceArticleDomains({
      websiteUrl: "https://www.bbc.com/news",
      providerId: "bbc-world",
      articleDomains: null,
    });
    assert.ok(domains.includes("bbc.com"));
    assert.ok(domains.includes("bbc.co.uk"));
    assert.deepEqual(
      resolveSourceArticleDomains({ websiteUrl: "https://www.pravda.com.ua", providerId: null }),
      ["pravda.com.ua"],
    );
  });

  it("5. Admin API validates articleDomains and persists them only for NEWS_SOURCE", async () => {
    assert.equal(normalizeApprovedDomain("WWW.Example.org."), "example.org");
    assert.equal(normalizeApprovedDomain("пример.укр"), "xn--e1afmkfd.xn--j1amh");
    for (const invalid of [
      "localhost",
      "10.0.0.1",
      "[::1]",
      "co.uk",
      "com.ua",
      "https://x.org/a",
      "a b.org",
      "org",
    ]) {
      assert.equal(normalizeApprovedDomain(invalid), null, invalid);
    }
    const base = {
      actorUserId: "admin-user",
      resourceType: "NEWS_SOURCE" as const,
      scopeType: "COUNTRY" as const,
      countryCode: "UA",
      name: "Cases Source",
      logoLabel: "CS",
      websiteUrl: "https://cases.example.org",
      rssUrl: "https://cases.example.org/rss.xml",
    };
    await assert.rejects(
      createAdminMediaResource({ ...base, articleDomains: ["169.254.169.254"] }),
      MediaResourceValidationError,
    );
    await assert.rejects(
      createAdminMediaResource({
        ...base,
        articleDomains: Array.from({ length: 11 }, (_, n) => `d${n}.example.org`),
      }),
      MediaResourceValidationError,
    );
    await assert.rejects(
      createAdminMediaResource({
        ...base,
        resourceType: "FACT_CHECKING",
        rssUrl: null,
        articleDomains: ["cases.example.org"],
      }),
      MediaResourceValidationError,
    );
    const created = await createAdminMediaResource({
      ...base,
      articleDomains: ["www.Cases-CDN.example.net", "cases-cdn.example.net"],
    });
    assert.deepEqual(created.articleDomains, ["cases-cdn.example.net"]);
    const unchanged = await updateAdminMediaResource({
      actorUserId: "admin-user",
      id: created.id,
      resourceType: "NEWS_SOURCE",
      name: "Cases Source Renamed",
    });
    assert.deepEqual(unchanged.articleDomains, ["cases-cdn.example.net"]);
    const cleared = await updateAdminMediaResource({
      actorUserId: "admin-user",
      id: created.id,
      resourceType: "NEWS_SOURCE",
      articleDomains: null,
    });
    assert.equal("articleDomains" in cleared, false);

    const document = toMediaResourceMongoDocument(created);
    assert.deepEqual(fromMediaResourceMongoDocument(document).articleDomains, [
      "cases-cdn.example.net",
    ]);
    assert.equal("articleDomains" in toMediaResourceMongoDocument(cleared), false);
  });
});

describe("RSS-SOURCE-02B — source identity", () => {
  it("6. rename: new articles follow the Admin name; selection by name also matches the id", async () => {
    await refreshPublicNews();
    await seed([newsSource("pravda-ua", "Ukrainska Pravda", FEEDS.pravda)]);
    // Before the next refresh, the renamed source still finds its id-tagged articles.
    const beforeRefresh = await listPublicNewsArticles({ limit: 6, sources: ["Ukrainska Pravda"] });
    assert.equal(beforeRefresh.items.length, 2);
    assert.ok(beforeRefresh.items.every((entry) => entry.sourceName === "Українська правда"));

    await refreshPublicNews();
    const afterRefresh = await listPublicNewsArticles({ limit: 6, sources: ["Ukrainska Pravda"] });
    assert.deepEqual(
      afterRefresh.items.map((entry) => entry.sourceName),
      ["Ukrainska Pravda", "Ukrainska Pravda"],
    );
    const oldName = await listPublicNewsArticles({ limit: 6, sources: ["Українська правда"] });
    assert.equal(oldName.items.length, 0, "inactive names still return nothing");
    const health = await healthOf("pravda-ua");
    assert.deepEqual(health?.lastStoredSourceNames, ["Ukrainska Pravda"]);
  });

  it("7. existing articles without a MediaResource id keep name-based compatibility", async () => {
    await seed([
      newsSource("ukrinform", "Ukrinform", FEEDS.ukrinform, { providerId: "ukrinform" }),
    ]);
    feedResponses = {};
    const now = new Date().toISOString();
    const legacy: NewsArticleRecord = {
      id: "news-legacy-ukrinform",
      provider: "rss",
      sourceName: "Ukrinform",
      sourceDomain: "ukrinform.net",
      title: "Legacy Ukrinform article stored before RSS-SOURCE-02B",
      summary: "Legacy summary text for compatibility checks.",
      articleUrl: "https://www.ukrinform.net/rubric-society/4182200-legacy.html",
      normalizedArticleUrl: "https://www.ukrinform.net/rubric-society/4182200-legacy.html",
      publishedAt: hoursAgo(3).toISOString(),
      fetchedAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      language: "en",
      status: "active",
      verificationStatus: "external-source",
      createdAt: now,
      updatedAt: now,
    };
    await upsertPublicNewsRecords([legacy]);
    const bySource = await listPublicNewsArticles({ limit: 6, sources: ["Ukrinform"] });
    assert.deepEqual(
      bySource.items.map((entry) => entry.id),
      [legacy.id],
    );
    const bySubstring = await listPublicNewsArticles({ limit: 6, source: "ukrin" });
    assert.deepEqual(
      bySubstring.items.map((entry) => entry.id),
      [legacy.id],
    );
    const all = await listPublicNewsArticles({ limit: 6 });
    assert.ok(all.items.some((entry) => entry.id === legacy.id));
    const country = await selectCountrySourceNewsArticles();
    assert.ok(country.some((record) => record.id === legacy.id));
  });

  it("8. country selection (translation input) matches renamed sources by id like the public API", async () => {
    await refreshPublicNews();
    await seed([newsSource("pravda-ua", "Ukrainska Pravda", FEEDS.pravda)]);
    const selected = await selectCountrySourceNewsArticles();
    const publicIds = (
      await listPublicNewsArticles({ limit: 6, sources: ["Ukrainska Pravda"] })
    ).items
      .map((entry) => entry.id)
      .sort();
    assert.deepEqual(
      selected
        .filter((record) => record.mediaResourceId === "pravda-ua")
        .map((r) => r.id)
        .sort(),
      publicIds,
    );
    assert.equal(new Set(selected.map((record) => record.id)).size, selected.length);
  });
});

describe("RSS-SOURCE-02B — HTTP security", () => {
  const options = { timeoutMs: 2_000, maxBytes: 2 * MB };

  it("9. address policy blocks private, reserved and mapped ranges", () => {
    for (const blocked of [
      "10.0.0.1",
      "127.0.0.1",
      "100.64.1.1",
      "169.254.169.254",
      "172.31.0.1",
      "192.168.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::a00:1",
      "2001:db8::1",
      "[::1]",
    ]) {
      assert.equal(isBlockedIpAddress(blocked), true, blocked);
    }
    for (const allowed of ["8.8.8.8", PUBLIC_IP, "2606:4700::6810:84e5"]) {
      assert.equal(isBlockedIpAddress(allowed), false, allowed);
    }
  });

  it("10. redirects are re-validated hop by hop; private targets are never contacted", async () => {
    dnsAnswers = (hostname) =>
      hostname === "internal.example"
        ? [{ address: "10.0.0.7", family: 4 }]
        : [{ address: PUBLIC_IP, family: 4 }];
    const cases: [string, string][] = [
      ["http://internal.example/feed", "Blocked resolved IP address."],
      ["http://169.254.169.254/latest/meta-data", "Blocked IP address."],
      ["http://[::1]:8080/feed", "Blocked hostname."],
      ["http://[::ffff:10.0.0.1]/feed", "Blocked IP address."],
      ["http://localhost/feed", "Blocked hostname."],
      ["file:///etc/passwd", "Only http and https URLs are allowed."],
      ["https://user:pw@feeds.example.org/x", "Blocked URL credentials."],
    ];
    for (const [location, message] of cases) {
      transportRequests = [];
      feedResponses = {
        "https://feeds.example.org/rss": () => ({ status: 302, headers: { Location: location } }),
      };
      await assert.rejects(
        fetchExternalDocument("https://feeds.example.org/rss", options),
        (error) => {
          assert.ok(error instanceof ExternalFetchPolicyError);
          assert.equal(error.code, "blocked_host");
          assert.equal(error.message, message);
          return true;
        },
      );
      assert.equal(transportRequests.length, 1, location);
    }

    feedResponses = {
      "https://feeds.example.org/rss": () => ({ status: 301, headers: { Location: "/rss2" } }),
      "https://feeds.example.org/rss2": () => ({
        status: 307,
        headers: { Location: "https://cdn.example.net/feed.xml" },
      }),
      "https://cdn.example.net/feed.xml": () => ({
        status: 200,
        body: "<rss/>",
        headers: { "Content-Type": "application/rss+xml" },
      }),
    };
    dnsCalls = [];
    let finalStatus = 0;
    const text = await fetchExternalDocument("https://feeds.example.org/rss", {
      ...options,
      onStatus: (status) => {
        finalStatus = status;
      },
    });
    assert.equal(text, "<rss/>");
    assert.equal(finalStatus, 200);
    assert.deepEqual(dnsCalls, ["feeds.example.org", "feeds.example.org", "cdn.example.net"]);

    feedResponses = {};
    for (let hop = 0; hop <= 6; hop += 1) {
      feedResponses[`https://loop.example.org/${hop}`] = () => ({
        status: 302,
        headers: { Location: `https://loop.example.org/${hop + 1}` },
      });
    }
    await assert.rejects(
      fetchExternalDocument("https://loop.example.org/0", options),
      /Too many redirects/,
    );
  });

  it("11. DNS rebinding: the connection is pinned to the validated address; re-resolution is re-checked", async () => {
    dnsAnswers = (_host, call) =>
      call === 1 ? [{ address: PUBLIC_IP, family: 4 }] : [{ address: "127.0.0.1", family: 4 }];
    feedResponses = {
      "https://rebind.example.org/rss": () => ({ status: 302, headers: { Location: "/next" } }),
      "https://rebind.example.org/next": () => ({ status: 200, body: "<rss/>" }),
    };
    await assert.rejects(
      fetchExternalDocument("https://rebind.example.org/rss", options),
      /Blocked resolved IP/,
    );
    assert.equal(transportRequests.length, 1);
    assert.equal(transportRequests[0]!.address, PUBLIC_IP);

    dnsAnswers = () => [
      { address: PUBLIC_IP, family: 4 },
      { address: "192.168.1.10", family: 4 },
    ];
    transportRequests = [];
    await assert.rejects(
      fetchExternalDocument("https://mixed.example.org/rss", options),
      /Blocked resolved IP/,
    );
    assert.equal(transportRequests.length, 0);

    // Dual-stack: IPv4 preferred as primary; every validated address is offered for fallback.
    dnsAnswers = () => [
      { address: "2606:4700::6810:84e5", family: 6 },
      { address: PUBLIC_IP, family: 4 },
    ];
    feedResponses["https://dual.example.org/rss"] = () => ({ status: 200, body: "<rss/>" });
    assert.equal(await fetchExternalDocument("https://dual.example.org/rss", options), "<rss/>");
    const dual = transportRequests.at(-1)!;
    assert.deepEqual([dual.address, dual.family], [PUBLIC_IP, 4]);
    assert.deepEqual(
      dual.addresses.map((entry) => entry.address),
      ["2606:4700::6810:84e5", PUBLIC_IP],
    );

    // The default transport never resolves the hostname itself: an unresolvable
    // name still reaches the pinned address, with the original Host header.
    let seenHost: IncomingHttpHeaders["host"];
    const server = createServer((req, res) => {
      seenHost = req.headers.host;
      res.writeHead(200, { "Content-Type": "application/rss+xml" });
      res.end("<rss/>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      const response = await pinnedNodeTransport({
        url: new URL(`http://feed.unresolvable-02b.invalid:${port}/rss`),
        address: "127.0.0.1",
        family: 4,
        addresses: [{ address: "127.0.0.1", family: 4 }],
        headers: {},
        signal: new AbortController().signal,
      });
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) {
        chunks.push(Buffer.from(chunk));
      }
      assert.equal(response.status, 200);
      assert.equal(Buffer.concat(chunks).toString(), "<rss/>");
      assert.equal(seenHost, `feed.unresolvable-02b.invalid:${port}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("12. oversized responses are refused: declared, streamed and decompressed", async () => {
    const tracked = toExternalHttpResponse(
      { status: 200, body: Buffer.alloc(3 * MB, 97) },
      256 * 1024,
    );
    setExternalHttpTransportForTests(async () => tracked);
    await assert.rejects(
      fetchExternalDocument("https://big.example.org/rss", options),
      /exceeded size limit/,
    );
    assert.equal(tracked.destroyed(), true, "stream is torn down at the limit");

    feedResponses = {
      "https://declared.example.org/rss": () => ({
        status: 200,
        headers: { "Content-Length": String(5 * MB) },
      }),
      "https://bomb.example.org/rss": () => ({
        status: 200,
        body: zlib.gzipSync(Buffer.alloc(8 * MB, 0)),
        headers: { "Content-Encoding": "gzip" },
      }),
      "https://gzip.example.org/rss": () => ({
        status: 200,
        body: zlib.gzipSync(Buffer.from("<rss>ok</rss>")),
        headers: { "Content-Encoding": "gzip" },
      }),
    };
    installMocks();
    await assert.rejects(
      fetchExternalDocument("https://declared.example.org/rss", options),
      (error) => {
        assert.equal(classifySourceFetchError(error).code, "response_too_large");
        return true;
      },
    );
    await assert.rejects(
      fetchExternalDocument("https://bomb.example.org/rss", options),
      (error) => {
        assert.equal(classifySourceFetchError(error).code, "response_too_large");
        return true;
      },
    );
    assert.equal(
      await fetchExternalDocument("https://gzip.example.org/rss", options),
      "<rss>ok</rss>",
    );
  });

  it("13. timeouts: a stalled connection or body ends within the deadline", async () => {
    setExternalHttpTransportForTests(() => new Promise(() => undefined));
    let started = Date.now();
    await assert.rejects(
      fetchExternalDocument("https://slow.example.org/rss", { ...options, timeoutMs: 60 }),
      (error) => {
        assert.equal(classifySourceFetchError(error).code, "timeout");
        return true;
      },
    );
    assert.ok(Date.now() - started < 1_000);

    setExternalHttpTransportForTests(async () => ({
      status: 200,
      headers: {},
      body: (async function* () {
        yield Buffer.from("<rss>");
        await new Promise(() => undefined);
      })(),
      destroy: () => undefined,
    }));
    started = Date.now();
    await assert.rejects(
      fetchExternalDocument("https://stall.example.org/rss", { ...options, timeoutMs: 60 }),
      (error) => {
        assert.equal(classifySourceFetchError(error).code, "timeout");
        return true;
      },
    );
    assert.ok(Date.now() - started < 1_000);
  });

  it("14. content types: binary and JSON refused; feeds, HTML and legacy charsets accepted", async () => {
    const cp1251 = Buffer.concat([
      Buffer.from('<?xml version="1.0" encoding="windows-1251"?><rss><title>'),
      Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2]),
      Buffer.from("</title></rss>"),
    ]);
    feedResponses = {
      "https://a.example.org/img": () => ({
        status: 200,
        body: "x",
        headers: { "Content-Type": "image/png" },
      }),
      "https://a.example.org/json": () => ({
        status: 200,
        body: "{}",
        headers: { "Content-Type": "application/json" },
      }),
      "https://a.example.org/html": () => ({
        status: 200,
        body: "<html/>",
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
      "https://a.example.org/none": () => ({ status: 200, body: "<rss/>" }),
      "https://a.example.org/cp1251": () => ({
        status: 200,
        body: cp1251,
        headers: { "Content-Type": "application/xml" },
      }),
      "https://a.example.org/utf8": () => ({
        status: 200,
        body: "<rss>Привіт</rss>",
        headers: { "Content-Type": "text/xml; charset=ISO-8859-1" },
      }),
    };
    installMocks();
    for (const path of ["img", "json"]) {
      await assert.rejects(
        fetchExternalDocument(`https://a.example.org/${path}`, options),
        (error) => {
          assert.equal(classifySourceFetchError(error).code, "unsupported_content_type");
          return true;
        },
      );
    }
    assert.equal(await fetchExternalDocument("https://a.example.org/html", options), "<html/>");
    assert.equal(await fetchExternalDocument("https://a.example.org/none", options), "<rss/>");
    assert.match(await fetchExternalDocument("https://a.example.org/cp1251", options), /Привіт/);
    assert.equal(
      await fetchExternalDocument("https://a.example.org/utf8", options),
      "<rss>Привіт</rss>",
    );
  });

  it("15. article URL validation uses the source's approved domains", async () => {
    const allowed = ["pravda.com.ua"];
    assert.equal(
      await validatePublicArticleUrl(pravdaItems[0]!.url, {
        timeoutMs: 100,
        allowedDomains: allowed,
      }),
      true,
    );
    for (const bad of maliciousItems) {
      assert.equal(
        await validatePublicArticleUrl(bad.url, { timeoutMs: 100, allowedDomains: allowed }),
        false,
        bad.url,
      );
    }
    dnsAnswers = () => [{ address: "10.1.1.1", family: 4 }];
    assert.equal(
      await validatePublicArticleUrl(pravdaItems[0]!.url, {
        timeoutMs: 100,
        allowedDomains: allowed,
      }),
      false,
    );
  });
});

describe("RSS-SOURCE-02B — ingestion reliability", () => {
  it("16. retry with exponential backoff for transient failures only", async () => {
    let calls = 0;
    feedResponses = {
      "https://flaky.example.org/rss": () => {
        calls += 1;
        return calls < 3 ? { status: 503, body: "busy" } : { status: 200, body: "<rss/>" };
      },
      "https://gone.example.org/rss": () => {
        calls += 1;
        return { status: 404, body: "missing" };
      },
      "https://limited.example.org/rss": () => {
        calls += 1;
        return { status: 429, body: "slow down", headers: { "Retry-After": "120" } };
      },
    };
    installMocks();
    const options = { timeoutMs: 1_000, maxBytes: MB };
    assert.equal(
      await fetchExternalDocumentWithRetry("https://flaky.example.org/rss", options),
      "<rss/>",
    );
    assert.equal(calls, 3);
    assert.equal(sleeps.length, 2);
    assert.ok(sleeps[0]! >= 500 && sleeps[0]! <= 1_000, String(sleeps[0]));
    assert.ok(sleeps[1]! >= 1_000 && sleeps[1]! <= 2_000, String(sleeps[1]));

    calls = 0;
    sleeps = [];
    await assert.rejects(
      fetchExternalDocumentWithRetry("https://gone.example.org/rss", options),
      ExternalRequestError,
    );
    assert.deepEqual([calls, sleeps.length], [1, 0], "4xx is not retried");

    calls = 0;
    sleeps = [];
    await assert.rejects(
      fetchExternalDocumentWithRetry("https://limited.example.org/rss", options),
      (error) => {
        assert.ok(error instanceof ExternalRequestError && error.status === 429);
        return true;
      },
    );
    assert.equal(calls, DEFAULT_FEED_RETRY_POLICY.maxAttempts);
    assert.ok(
      sleeps.every((ms) => ms === DEFAULT_FEED_RETRY_POLICY.maxDelayMs),
      "Retry-After is capped",
    );

    sleeps = [];
    dnsAnswers = () => [{ address: "10.0.0.1", family: 4 }];
    await assert.rejects(
      fetchExternalDocumentWithRetry("https://private.example.org/rss", options),
      ExternalFetchPolicyError,
    );
    assert.equal(sleeps.length, 0, "policy failures are not retried");

    assert.equal(
      computeRetryDelayMs(1, DEFAULT_FEED_RETRY_POLICY, null, () => 1),
      1_000,
    );
    assert.equal(
      computeRetryDelayMs(2, DEFAULT_FEED_RETRY_POLICY, null, () => 0),
      1_000,
    );
    assert.equal(
      computeRetryDelayMs(6, DEFAULT_FEED_RETRY_POLICY, null, () => 1),
      10_000,
    );
  });

  it("17. bounded fetch concurrency across many sources; result order preserved", async () => {
    const resources = Array.from({ length: 15 }, (_, n) =>
      newsSource(`src-${n}`, `Source ${n}`, `https://feeds${n}.example.org/rss`),
    );
    await seed(resources);
    let inFlight = 0;
    let peak = 0;
    setExternalHttpTransportForTests(async (request) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      transportRequests.push(request);
      return toExternalHttpResponse({ status: 200, body: rss([]) });
    });
    await refreshPublicNews();
    assert.equal(transportRequests.length, 15);
    assert.ok(peak <= RSS_FETCH_CONCURRENCY && peak > 1, String(peak));
    assert.deepEqual(
      await mapWithConcurrency([5, 1, 3], 2, async (value) => {
        await new Promise((resolve) => setTimeout(resolve, value));
        return value * 10;
      }),
      [50, 10, 30],
    );
  });

  it("18. concurrent refreshes: one in-process run, cross-instance lease, follow-up after holder failure", async () => {
    const [first, second] = await Promise.all([refreshPublicNews(), refreshPublicNews()]);
    assert.deepEqual([first.upserted, second.upserted].sort(), [0, 2]);
    assert.equal(transportRequests.length, 1, "the feed was fetched once");

    // Another instance holds the lease.
    const other = await tryAcquirePublicNewsRefreshLease();
    assert.equal(other.acquired, true);
    transportRequests = [];
    const skipped = await refreshPublicNews();
    assert.equal(skipped.skipped, "lease_held");
    assert.ok(skipped.retryAt && skipped.retryAt > Date.now());
    assert.equal(transportRequests.length, 0);
    const followUpDelay = resolveLeaseFollowUpDelayMs(skipped, Date.now(), () => 0);
    assert.ok(followUpDelay !== null && followUpDelay >= 60_000 && followUpDelay <= 30 * 60_000);
    assert.equal(resolveLeaseFollowUpDelayMs(first, Date.now()), null);

    // The holder completes: a deferred follow-up from before completion skips.
    const skippedAt = new Date(Date.now() - 1_000);
    if (other.acquired) {
      await other.lease.release({ completed: true });
    }
    const followUp = await refreshPublicNews({ skipIfCompletedSince: skippedAt });
    assert.equal(followUp.skipped, "completed_elsewhere");
    assert.equal(transportRequests.length, 0);

    // A holder that dies without completing: the lease expires and the follow-up runs.
    resetPublicNewsRefreshLeaseForTests();
    const crashed = await tryAcquirePublicNewsRefreshLease({
      now: new Date(Date.now() - 31 * 60_000),
    });
    assert.equal(crashed.acquired, true);
    const takeover = await refreshPublicNews({ skipIfCompletedSince: new Date() });
    assert.equal(takeover.skipped, undefined);
    assert.equal(transportRequests.length, 1);
    const relock = await tryAcquirePublicNewsRefreshLease();
    assert.equal(relock.acquired, true, "the lease is released after a refresh");
  });
});

describe("RSS-SOURCE-02B — telemetry accuracy", () => {
  it("19. per-source accepted/rejected counts, identity and sanitized security errors", async () => {
    feedResponses[FEEDS.hromadske] = () => ({
      status: 302,
      headers: { Location: "http://metadata.internal.example/latest" },
    });
    dnsAnswers = (hostname) =>
      hostname === "metadata.internal.example"
        ? [{ address: "169.254.169.254", family: 4 }]
        : [{ address: PUBLIC_IP, family: 4 }];
    const staleItem = item(
      "https://www.pravda.com.ua/eng/news/2026/10/01/7400000/",
      "Stale pravda article",
      24 * 20,
    );
    feedResponses[FEEDS.pravda] = () => ({
      status: 200,
      body: rss([...pravdaItems, ...maliciousItems.slice(0, 2), staleItem]),
    });
    await seed([
      newsSource("pravda-ua", "Українська правда", FEEDS.pravda),
      newsSource("hromadske", "Hromadske", FEEDS.hromadske),
    ]);
    await refreshPublicNews();

    const pravda = await healthOf("pravda-ua");
    assert.equal(pravda?.lastOutcome, "success");
    assert.equal(pravda?.lastParsedCount, 5);
    assert.equal(pravda?.lastAcceptedCount, 2);
    assert.equal(pravda?.lastRejectedCount, 3);
    assert.deepEqual(pravda?.lastRejectionReasons, {
      outside_retention_window: 1,
      unapproved_article_domain: 2,
    });
    assert.deepEqual(pravda?.lastStoredSourceNames, ["Українська правда"]);
    assert.equal(pravda?.sourceName, "Українська правда");

    const hromadske = await healthOf("hromadske");
    assert.equal(hromadske?.lastOutcome, "fetch_failed");
    assert.deepEqual(hromadske?.lastError, {
      code: "blocked_host",
      message: "The feed host is not allowed.",
      httpStatus: null,
    });
    assert.equal(hromadske?.sourceName, "Hromadske");
    const serialized = JSON.stringify(hromadske);
    assert.doesNotMatch(serialized, /169\.254|metadata\.internal|latest/);

    const listing = await listAdminNewsSourceHealth({ actorUserId: "admin-user" });
    const byId = Object.fromEntries(listing.items.map((entry) => [entry.mediaResourceId, entry]));
    assert.deepEqual(
      [byId["pravda-ua"]?.status, byId["pravda-ua"]?.publicArticleCount],
      ["healthy", 2],
    );
    assert.deepEqual(
      [byId.hromadske?.status, byId.hromadske?.statusReason],
      ["failing", "fetch_failed"],
    );

    for (const [error, code] of [
      [
        new ExternalFetchPolicyError("too_many_redirects", "Too many redirects."),
        "too_many_redirects",
      ],
      [
        new ExternalFetchPolicyError("unsupported_content_type", "Unsupported content type."),
        "unsupported_content_type",
      ],
      [new ExternalFetchPolicyError("timeout", "External request timed out."), "timeout"],
    ] as const) {
      assert.equal(classifySourceFetchError(error).code, code);
    }
  });
});

describe("RSS-SOURCE-02B.1 — lease failure mode and follow-ups", () => {
  afterEach(() => {
    setPublicNewsRefreshLeaseFailureForTests(null);
    stopPublicNewsScheduler();
  });

  it("20. lease store failure fails closed: no fetch, no writes, existing articles kept", async () => {
    await refreshPublicNews();
    const before = (await stored()).map((article) => article.id).sort();
    assert.equal(before.length, 2);
    transportRequests = [];
    setPublicNewsRefreshLeaseFailureForTests(new Error("lease store down"));
    const result = await refreshPublicNews();
    assert.deepEqual(result, { upserted: 0, fetched: 0, skipped: "lease_unavailable" });
    assert.equal(transportRequests.length, 0);
    assert.deepEqual((await stored()).map((article) => article.id).sort(), before);
    const delay = resolveLeaseFollowUpDelayMs(result, Date.now(), () => 0);
    assert.equal(delay, 5 * 60_000, "bounded retry instead of a tight loop");
  });

  it("21. one pending follow-up per instance, however many skips occur", async () => {
    const other = await tryAcquirePublicNewsRefreshLease({ renewEveryMs: 0 });
    assert.equal(other.acquired, true);
    const before = getScheduledLeaseFollowUpsForTests().scheduled;
    startPublicNewsScheduler();
    for (
      let attempt = 0;
      attempt < 50 && !getScheduledLeaseFollowUpsForTests().pending;
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(getScheduledLeaseFollowUpsForTests().pending, true);
    await runScheduledRefresh();
    await runScheduledRefresh();
    assert.equal(getScheduledLeaseFollowUpsForTests().scheduled - before, 1);
    assert.equal(transportRequests.length, 0);
    stopPublicNewsScheduler();
    assert.equal(getScheduledLeaseFollowUpsForTests().pending, false);
  });
});

describe("RSS-SOURCE-02B.1 — original-language ingestion", () => {
  const UK_FEED = "https://www.pravda.com.ua/rss/";
  const ukItems = Array.from({ length: 70 }, (_, n) =>
    item(
      `https://www.pravda.com.ua/news/2026/11/06/75${String(n).padStart(5, "0")}/`,
      `Українська новина номер ${n} про події дня`,
      1 + n / 100,
    ),
  );

  beforeEach(async () => {
    feedResponses[UK_FEED] = () => ({ status: 200, body: rss(ukItems) });
    await seed([
      newsSource("pravda-ua", "Українська правда", FEEDS.pravda),
      newsSource("pravda-uk", "Українська правда (UA)", UK_FEED, { language: "UK" }),
    ]);
  });

  it("22. sources in other languages are ingested untranslated, in their own language", async () => {
    await refreshPublicNews();
    const uk = await findActivePublicNewsRecords({ limit: 100, language: "uk" });
    assert.equal(uk.length, 60, "each language keeps its own fetch limit");
    assert.ok(uk.every((record) => record.mediaResourceId === "pravda-uk"));
    assert.ok(uk.some((record) => record.title === "Українська новина номер 0 про події дня"));
    const en = await findActivePublicNewsRecords({ limit: 100, language: "en" });
    assert.deepEqual(
      en.map((record) => record.articleUrl).sort(),
      pravdaItems.map((entry) => entry.url).sort(),
      "default-language articles are not displaced",
    );
    const byLanguage = await listPublicNewsArticles({
      limit: 6,
      language: "uk",
      sources: ["Українська правда (UA)"],
    });
    assert.equal(byLanguage.items.length, 6);
    assert.ok(byLanguage.items.every((entry) => entry.language === "uk"));
  });

  it("23. default public views, translation selections and notifications stay English-only", async () => {
    resetPublicPresentationChangeCountForTests();
    await refreshPublicNews();
    assert.equal(publicPresentationChangeCountForTests(), 2, "only the 2 English records notify");
    const defaultListing = await listPublicNewsArticles({ limit: 50 });
    assert.ok(defaultListing.items.every((entry) => entry.language === "en"));
    assert.ok(!defaultListing.activeProviders.includes("Українська правда (UA)"));
    const consumer = await selectMediaPlpConsumerNewsArticles({ limit: 50 });
    assert.ok(consumer.every((record) => record.language === "en"));
    const country = await selectCountrySourceNewsArticles();
    assert.ok(country.every((record) => record.language === "en"));
  });

  it("24. Admin health counts each source in its own language", async () => {
    await refreshPublicNews();
    const listing = await listAdminNewsSourceHealth({ actorUserId: "admin-user" });
    const byId = Object.fromEntries(listing.items.map((entry) => [entry.mediaResourceId, entry]));
    assert.deepEqual(
      [
        byId["pravda-uk"]?.status,
        byId["pravda-uk"]?.publicArticleCount,
        byId["pravda-uk"]?.publicArticleCountCapped,
      ],
      ["healthy", 50, true],
    );
    assert.deepEqual(
      [byId["pravda-ua"]?.status, byId["pravda-ua"]?.publicArticleCount],
      ["healthy", 2],
    );
    const health = await healthOf("pravda-uk");
    assert.deepEqual(
      [health?.lastParsedCount, health?.lastAcceptedCount, health?.lastRejectionReasons],
      [70, 60, { per_source_cap: 10 }],
    );
  });
});

describe("RSS-SOURCE-02B.1 — source identity", () => {
  it("25. one feed shared by two Admin sources never produces duplicate public articles", async () => {
    await seed([
      newsSource("pravda-ua", "Українська правда", FEEDS.pravda),
      newsSource("pravda-world", "Ukrainska Pravda World", FEEDS.pravda, {
        scopeType: "WORLD",
        countryCode: null,
      }),
    ]);
    await refreshPublicNews();
    await refreshPublicNews();
    const all = await stored();
    assert.equal(all.length, 2);
    assert.equal(new Set(all.map((record) => record.normalizedArticleUrl)).size, 2);
    const both = await listPublicNewsArticles({
      limit: 10,
      sources: ["Українська правда", "Ukrainska Pravda World"],
    });
    assert.equal(both.items.length, 2);
    assert.equal(new Set(both.items.map((entry) => entry.id)).size, 2);
    const country = await selectCountrySourceNewsArticles();
    assert.equal(new Set(country.map((record) => record.id)).size, country.length);
  });
});
