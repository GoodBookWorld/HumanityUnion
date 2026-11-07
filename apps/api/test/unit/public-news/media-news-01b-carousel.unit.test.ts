/**
 * MEDIA-NEWS-01B — /media news carousel priority selection, its translation parity,
 * the unchanged default listing, and publisher logo resolution (memory persistence).
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import type { MediaResource, NewsArticleRecord } from "@hu/types";

import {
  selectCountrySourceNewsArticles,
  selectMediaPlpConsumerNewsIds,
} from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { sanitizePublicLogoUrl } from "../../../src/modules/public-news/public-news-logo-url.js";
import {
  ActiveNewsSourceIndex,
  createNewsSourceLogoResolver,
  selectMediaCarouselNewsRecords,
} from "../../../src/modules/public-news/public-news-media-carousel.js";
import {
  findActivePublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import {
  listPublicNewsArticles,
  parsePublicNewsQuery,
} from "../../../src/modules/public-news/public-news.service.js";

const NOW = "2026-11-06T12:00:00.000Z";
const at = (hoursAgo: number) => new Date(Date.parse(NOW) - hoursAgo * 3_600_000).toISOString();

function source(
  id: string,
  website: string,
  overrides: Partial<MediaResource> = {},
): MediaResource {
  return {
    id,
    resourceType: "NEWS_SOURCE",
    scopeType: "WORLD",
    countryCode: null,
    name: `Source ${id}`,
    logoLabel: id.slice(0, 3).toUpperCase(),
    logoUrl: null,
    websiteUrl: website,
    rssUrl: `${website}/rss`,
    language: "en",
    providerId: null,
    active: true,
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let articleCounter = 0;
function article(
  resource: MediaResource | { name: string; website: string },
  hoursAgo: number,
  overrides: Partial<NewsArticleRecord> = {},
): NewsArticleRecord {
  articleCounter += 1;
  const website = "websiteUrl" in resource ? resource.websiteUrl : resource.website;
  const url = `${website.replace(/\/$/, "")}/world/2026/11/06/story-${articleCounter}`;
  return {
    id: `news-${String(articleCounter).padStart(4, "0")}`,
    provider: "rss",
    sourceName: resource.name,
    ...("id" in resource ? { mediaResourceId: resource.id } : {}),
    title: `Story ${articleCounter}`,
    summary: "Summary.",
    articleUrl: url,
    normalizedArticleUrl: url.toLowerCase(),
    publishedAt: at(hoursAgo),
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

async function seed(resources: MediaResource[], records: NewsArticleRecord[]): Promise<void> {
  resetMediaResourcesMemoryForTests();
  for (const resource of resources) {
    upsertMediaResourceMemory(resource);
  }
  resetPublicNewsMemoryStoreForTests();
  await upsertPublicNewsRecords(records);
}

const carousel = (limit = 12) =>
  selectMediaCarouselNewsRecords({ limit, language: "en", now: NOW });

const PRIORITY = {
  euronews: source("euronews", "https://www.euronews.com"),
  aljazeera: source("aljazeera", "https://www.aljazeera.com"),
  guardian: source("guardian", "https://www.theguardian.com/international"),
  nyt: source("nyt", "https://www.nytimes.com/section/world"),
  economist: source("economist", "https://www.economist.com/international"),
  wapo: source("wapo", "https://www.washingtonpost.com"),
};
const others = Array.from({ length: 8 }, (_, n) =>
  source(`other-${n}`, `https://other-${n}.example.org`),
);

before(() => {
  setMediaResourceForceMemoryForTests(true);
});

beforeEach(() => {
  articleCounter = 0;
});

after(() => {
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  setMediaResourceForceMemoryForTests(false);
});

const sourcesOf = (records: readonly NewsArticleRecord[]) =>
  records.map((record) => record.mediaResourceId ?? record.sourceName);
const countBy = (values: readonly string[]) =>
  values.reduce<Record<string, number>>(
    (acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }),
    {},
  );

describe("MEDIA-NEWS-01B — selection passes", () => {
  it("1. passes 1 and 2: every available priority source first, at most two each, before newer others", async () => {
    const priority = Object.values(PRIORITY);
    await seed(
      [...priority, ...others],
      [
        ...priority.flatMap((resource, n) => [
          article(resource, 20 + n),
          article(resource, 30 + n),
          article(resource, 40 + n),
        ]),
        ...others.flatMap((resource, n) => [article(resource, 1 + n), article(resource, 2 + n)]),
      ],
    );
    const selected = await carousel();
    assert.equal(selected.length, 12);
    const counts = countBy(sourcesOf(selected));
    for (const resource of priority) {
      assert.equal(counts[resource.id], 2, resource.id);
    }
    assert.ok(!selected.some((record) => record.mediaResourceId?.startsWith("other-")));
  });

  it("2. pass 3 fills with other active sources round-robin; no third priority article", async () => {
    const priority = [PRIORITY.guardian, PRIORITY.nyt, PRIORITY.euronews];
    await seed(
      [...priority, ...others],
      [
        ...priority.flatMap((resource) => [
          article(resource, 1),
          article(resource, 2),
          article(resource, 3),
        ]),
        ...others.flatMap((resource, n) => [article(resource, 10 + n), article(resource, 11 + n)]),
      ],
    );
    const selected = await carousel();
    const counts = countBy(sourcesOf(selected));
    assert.equal(selected.length, 12);
    for (const resource of priority) {
      assert.equal(counts[resource.id], 2);
    }
    const otherIds = Object.keys(counts).filter((key) => key.startsWith("other-"));
    assert.equal(otherIds.length, 6, "six different other sources, one article each");
    assert.ok(otherIds.every((key) => counts[key] === 1));
    assert.deepEqual(otherIds.sort(), [
      "other-0",
      "other-1",
      "other-2",
      "other-3",
      "other-4",
      "other-5",
    ]);
  });

  it("3. Global News configured as COUNTRY is a priority publisher: pass 1, capped at two", async () => {
    const globalNewsCa = source("global-news-ca", "https://globalnews.ca", {
      scopeType: "COUNTRY",
      countryCode: "CA",
    });
    await seed(
      [PRIORITY.guardian, PRIORITY.nyt, globalNewsCa, ...others],
      [
        article(PRIORITY.guardian, 1),
        article(PRIORITY.guardian, 2),
        article(PRIORITY.nyt, 3),
        article(PRIORITY.nyt, 4),
        article(globalNewsCa, 50),
        article(globalNewsCa, 51),
        article(globalNewsCa, 52),
        ...others.map((resource, n) => article(resource, 5 + n)),
      ],
    );
    const three = await carousel(3);
    assert.deepEqual(
      [...new Set(sourcesOf(three))].sort(),
      ["global-news-ca", "guardian", "nyt"],
      "pass 1 takes one article from each priority publisher, including COUNTRY Global News",
    );
    const all = await carousel(12);
    const counts = countBy(sourcesOf(all));
    assert.equal(counts["global-news-ca"], 2, "pass 2 second article; cap of two holds");
    assert.equal(all.length, 12);
  });

  it("3b. a non-priority COUNTRY source stays in pass 3", async () => {
    const countryOnly = source("la-presse", "https://www.lapresse.ca", {
      scopeType: "COUNTRY",
      countryCode: "CA",
    });
    await seed(
      [PRIORITY.guardian, PRIORITY.nyt, countryOnly],
      [
        article(PRIORITY.guardian, 30),
        article(PRIORITY.guardian, 31),
        article(PRIORITY.nyt, 32),
        article(PRIORITY.nyt, 33),
        article(countryOnly, 1),
        article(countryOnly, 2),
        article(countryOnly, 3),
      ],
    );
    const four = await carousel(4);
    assert.ok(
      !four.some((record) => record.mediaResourceId === "la-presse"),
      "newer COUNTRY articles do not displace priority passes",
    );
    const all = await carousel(12);
    assert.equal(countBy(sourcesOf(all))["la-presse"], 3, "pass 3 fills from it, uncapped");
  });

  it("4. priority sources are identified by verified domain, never by name", async () => {
    const fakeName = source("fan-site", "https://guardian-fan.example.org", {
      name: "The Guardian",
    });
    const renamed = source("grauniad", "https://www.theguardian.com", { name: "Grauniad" });
    const lookalike = source("lookalike", "https://nytimes.com.evil.example", {
      name: "The New York Times",
    });
    const filler = source("filler", "https://filler.example.org");
    await seed(
      [fakeName, renamed, lookalike, filler],
      [
        article(fakeName, 1),
        article(lookalike, 1),
        article(filler, 2),
        article(renamed, 50),
        article(renamed, 51),
      ],
    );
    const top2 = await carousel(2);
    assert.deepEqual(sourcesOf(top2).sort(), ["grauniad", "grauniad"]);
  });

  it("5. inactive sources are excluded, with or without a MediaResource id", async () => {
    const inactive = source("inactive", "https://inactive.example.org", {
      active: false,
      name: "Inactive",
    });
    const live = source("live", "https://live.example.org", { name: "Live" });
    await seed(
      [inactive, live],
      [
        article(inactive, 1),
        article({ name: "Inactive", website: "https://inactive.example.org" }, 2),
        article(live, 3),
      ],
    );
    assert.deepEqual(sourcesOf(await carousel()), ["live"]);
  });

  it("6. legacy articles join their source by name only when the URL is on its domains", async () => {
    const legacySource = source("legacy", "https://legacy.example.org", { name: "Legacy News" });
    await seed(
      [legacySource],
      [
        article({ name: "Legacy News", website: "https://legacy.example.org" }, 1),
        article({ name: "Legacy News", website: "https://impostor.example.com" }, 2),
        article({ name: "Unknown Source", website: "https://unknown.example.org" }, 3),
      ],
    );
    const selected = await carousel();
    assert.equal(selected.length, 1);
    assert.match(selected[0]!.articleUrl, /legacy\.example\.org/);
  });

  it("7. duplicates by normalized URL are removed; final order is newest-first and stable", async () => {
    const a = source("dup-a", "https://dup.example.org");
    const b = source("dup-b", "https://dup.example.org", {
      rssUrl: "https://dup.example.org/other-rss",
    });
    const first = article(a, 5);
    const sameUrl = article(b, 4, {
      articleUrl: first.articleUrl.toUpperCase().replace("HTTPS://", "https://"),
      normalizedArticleUrl: first.normalizedArticleUrl,
    });
    await seed(
      [a, b, PRIORITY.guardian],
      [first, sameUrl, article(PRIORITY.guardian, 9), article(PRIORITY.guardian, 1)],
    );
    const selected = await carousel();
    assert.equal(
      new Set(selected.map((record) => record.normalizedArticleUrl)).size,
      selected.length,
    );
    assert.equal(selected.length, 3);
    const times = selected.map((record) => record.publishedAt);
    assert.deepEqual(times, [...times].sort().reverse(), "newest first");
    assert.deepEqual(sourcesOf(await carousel()), sourcesOf(selected), "deterministic");
  });

  it("8. fewer than 12 candidates: everything available is returned", async () => {
    await seed(
      [PRIORITY.euronews, others[0]!],
      [article(PRIORITY.euronews, 1), article(others[0]!, 2)],
    );
    assert.equal((await carousel()).length, 2);
  });
});

describe("MEDIA-NEWS-01B — API contract and translation parity", () => {
  beforeEach(async () => {
    const priority = Object.values(PRIORITY);
    const inactive = source("inactive-old", "https://inactive-old.example.org", { active: false });
    await seed(
      [...priority, ...others, inactive],
      [
        ...priority.flatMap((resource, n) => [
          article(resource, 20 + n),
          article(resource, 30 + n),
        ]),
        ...others.flatMap((resource, n) => [article(resource, 1 + n)]),
        article(inactive, 0.5),
      ],
    );
  });

  it("9. carousel=media returns the shared selection; the PLP prebuild selects identical IDs in order", async () => {
    const listing = await listPublicNewsArticles(
      parsePublicNewsQuery({ carousel: "media", limit: "12", language: "en" }),
    );
    const direct = await selectMediaCarouselNewsRecords({ limit: 12, language: "en" });
    const plp = await selectMediaPlpConsumerNewsIds({ limit: 12 });
    assert.deepEqual(
      listing.items.map((item) => item.id),
      direct.map((record) => record.id),
    );
    assert.deepEqual(
      plp,
      direct.map((record) => record.id),
      "translation prebuild parity",
    );
    assert.ok(!listing.items.some((item) => item.sourceName === "Source inactive-old"));
  });

  it("10. carousel mode is explicit and rejects filters or unknown values", () => {
    assert.equal(parsePublicNewsQuery({ limit: "12" }).carousel, undefined);
    assert.throws(() => parsePublicNewsQuery({ carousel: "country" }), /only "media"/);
    for (const filter of [{ sources: "A" }, { source: "a" }, { category: "democracy" }]) {
      assert.throws(
        () => parsePublicNewsQuery({ carousel: "media", ...filter }),
        /cannot be combined/,
      );
    }
  });

  it("11. the default listing, sources= filtering and Country News selection are unchanged", async () => {
    const legacyDefault = await findActivePublicNewsRecords({ limit: 12, language: "en" });
    const listing = await listPublicNewsArticles(
      parsePublicNewsQuery({ limit: "12", language: "en" }),
    );
    assert.deepEqual(
      listing.items.map((item) => item.id),
      legacyDefault.map((record) => record.id),
    );
    assert.ok(
      listing.items.some((item) => item.sourceName === "Source inactive-old"),
      "default semantics kept",
    );

    const bySource = await listPublicNewsArticles(
      parsePublicNewsQuery({ sources: "Source guardian", limit: "6" }),
    );
    assert.ok(bySource.items.length > 0);
    assert.ok(bySource.items.every((item) => item.sourceName === "Source guardian"));
    assert.deepEqual(
      (await selectCountrySourceNewsArticles()).map((record) => record.id),
      [],
      "no COUNTRY sources here: Country News selection is untouched by the carousel",
    );
  });
});

describe("MEDIA-NEWS-01B — publisher logos", () => {
  const record = (overrides: Partial<NewsArticleRecord>) =>
    article({ name: "X", website: "https://x.example.org" }, 1, overrides);

  it("12. resolution order: NEWS_SOURCE logo, registry, Trusted Media, label only", () => {
    const own = source("own", "https://own.example.org", {
      logoUrl: "https://media.huws.org/media-resources/own.webp",
      logoLabel: "OWN",
    });
    const registryLinked = source("reg", "https://www.theguardian.com", {
      providerId: "the-guardian",
      logoLabel: "GU",
    });
    const viaTrusted = source("tr", "https://www.pravda.com.ua", { logoLabel: "УП" });
    const bare = source("bare", "https://bare.example.org", { logoLabel: "BA" });
    const trusted: MediaResource = {
      ...source("trusted-up", "https://pravda.com.ua"),
      resourceType: "TRUSTED_MEDIA",
      categoryId: "independent-investigative",
      rssUrl: null,
      logoUrl: "https://media.huws.org/media-resources/up.webp",
      logoLabel: "UP",
    };
    const resolve = createNewsSourceLogoResolver([own, registryLinked, viaTrusted, bare, trusted]);
    assert.deepEqual(resolve(record({ mediaResourceId: "own" })), {
      sourceLogoUrl: "https://media.huws.org/media-resources/own.webp",
      sourceLogoLabel: "OWN",
    });
    assert.deepEqual(resolve(record({ mediaResourceId: "reg" })), {
      sourceLogoUrl: "/images/media/guardian.webp",
      sourceLogoLabel: "GU",
    });
    assert.deepEqual(resolve(record({ mediaResourceId: "tr" })), {
      sourceLogoUrl: "https://media.huws.org/media-resources/up.webp",
      sourceLogoLabel: "УП",
    });
    assert.deepEqual(resolve(record({ mediaResourceId: "bare" })), { sourceLogoLabel: "BA" });
    assert.deepEqual(
      resolve(
        record({
          sourceName: "NYT legacy",
          articleUrl: "https://www.nytimes.com/2026/11/06/world/a.html",
        }),
      ),
      { sourceLogoUrl: "/images/media/nytimes.webp", sourceLogoLabel: "NYT" },
      "legacy article: registry by verified article domain",
    );
    assert.deepEqual(resolve(record({ sourceName: "Nobody" })), {});
  });

  it("13. unsafe NEWS_SOURCE logos are skipped in favour of the next level", () => {
    for (const unsafe of [
      "https://evil.example.com/logo.webp",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//media.huws.org/x.webp",
      "/images/../secrets.webp",
      "/uploads/logo.webp",
      "http://media.huws.org/x.webp",
    ]) {
      const resolve = createNewsSourceLogoResolver([
        source("g", "https://www.theguardian.com", { providerId: "the-guardian", logoUrl: unsafe }),
      ]);
      assert.equal(
        resolve(record({ mediaResourceId: "g" })).sourceLogoUrl,
        "/images/media/guardian.webp",
        unsafe,
      );
    }
    const inactiveOwn = createNewsSourceLogoResolver([
      source("i", "https://i.example.org", {
        active: false,
        logoUrl: "https://media.huws.org/i.webp",
        logoLabel: "II",
      }),
    ]);
    assert.deepEqual(
      inactiveOwn(record({ mediaResourceId: "i" })),
      {},
      "inactive resources give no logo",
    );
  });

  it("14. logo URL rule: HTTPS media host or safe /images/ paths only", () => {
    for (const ok of [
      "/images/media/bbc.webp",
      "/images/media/canada/global-news.webp",
      "https://media.huws.org/media-resources/1791-abc.webp",
    ]) {
      assert.equal(sanitizePublicLogoUrl(ok), ok, ok);
    }
    for (const bad of [
      "https://example.com/logo.png",
      "https://media.huws.org.evil.example/logo.png",
      "https://user:pw@media.huws.org/logo.png",
      "https://media.huws.org:8443/logo.png",
      "javascript:alert(1)",
      "data:image/svg+xml,<svg/>",
      "//media.huws.org/logo.png",
      "/images/../../etc/passwd",
      "/images/%2e%2e/x.webp",
      "/images/media/logo.exe",
      "/static/logo.webp",
      "\\images\\logo.webp",
    ]) {
      assert.equal(sanitizePublicLogoUrl(bad), undefined, bad);
    }
    process.env.R2_PUBLIC_BASE_URL = "https://media-staging.example.org";
    assert.equal(
      sanitizePublicLogoUrl("https://media-staging.example.org/logo.webp"),
      "https://media-staging.example.org/logo.webp",
    );
    delete process.env.R2_PUBLIC_BASE_URL;
  });

  it("15. the public API returns the logo fields for carousel and default listings", async () => {
    await seed(
      [
        source("lg", "https://www.theguardian.com", {
          providerId: "the-guardian",
          logoUrl: "https://media.huws.org/media-resources/guardian.webp",
          logoLabel: "G",
        }),
      ],
      [],
    );
    await upsertPublicNewsRecords([article(source("lg", "https://www.theguardian.com"), 1)]);
    for (const query of [{ carousel: "media" }, {}]) {
      const listing = await listPublicNewsArticles(
        parsePublicNewsQuery({ limit: "12", language: "en", ...query }),
      );
      assert.equal(
        listing.items[0]?.sourceLogoUrl,
        "https://media.huws.org/media-resources/guardian.webp",
      );
      assert.equal(listing.items[0]?.sourceLogoLabel, "G");
    }
    assert.ok(
      new ActiveNewsSourceIndex([]).resolve({ sourceName: "x", articleUrl: "https://x.org/a" }) ===
        null,
    );
  });
});
