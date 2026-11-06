/**
 * COUNTRY-MEDIA-NEWS-01 — public country NEWS_SOURCE list and exact `sources=`
 * filtering on GET /api/v1/public/news.
 */
process.env.NODE_TEST_ENV = "true";
process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import express from "express";
import type {
  MediaResource,
  NewsArticleRecord,
  PublicCountryNewsSource,
  PublicNewsListingResponse,
} from "@hu/types";
import { COUNTRY_NEWS_RAIL_LIMIT, listCountryNewsFallbackSourceNames } from "@hu/media-registry";

import { countryStatisticsRouter } from "../../../src/modules/country-statistics/index.js";
import { selectCountrySourceNewsArticles } from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
import { ensureMediaResourcesSeededOnce } from "../../../src/modules/media-resources/media-resource.service.js";
import {
  resetMediaResourcesMemoryForTests,
  upsertMediaResourceMemory,
} from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { publicNewsRouter } from "../../../src/modules/public-news/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import { parsePublicNewsQuery } from "../../../src/modules/public-news/public-news.service.js";

const TIMESTAMP = "2026-10-01T00:00:00.000Z";

function newsSource(id: string, overrides: Partial<MediaResource> = {}): MediaResource {
  return {
    id,
    resourceType: "NEWS_SOURCE",
    scopeType: "COUNTRY",
    countryCode: "UA",
    name: `Source ${id}`,
    logoLabel: id.slice(0, 2).toUpperCase(),
    websiteUrl: `https://${id}.example.test`,
    rssUrl: `https://${id}.example.test/rss`,
    language: "en",
    providerId: id,
    description: "Private admin description",
    secondaryText: "Private admin note",
    active: true,
    sortOrder: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function article(id: string, sourceName: string, publishedAt: string): NewsArticleRecord {
  return {
    id,
    provider: "test",
    sourceName,
    title: `Title ${id} long enough for public news checks.`,
    summary: `Summary ${id} long enough for public news checks here.`,
    articleUrl: `https://example.com/${id}`,
    normalizedArticleUrl: `https://example.com/${id}`,
    publishedAt,
    fetchedAt: TIMESTAMP,
    expiresAt: "2099-12-31T00:00:00.000Z",
    language: "en",
    category: "peace and security",
    status: "active",
    verificationStatus: "external-source",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

const dayAt = (day: number) => `2030-01-${String(day).padStart(2, "0")}T00:00:00.000Z`;

let server: Server;
let baseUrl = "";

interface Envelope<T> {
  success: boolean;
  data: T;
  meta: Record<string, unknown>;
}

async function getJson<T>(path: string): Promise<{ status: number; body: Envelope<T> }> {
  const res = await fetch(baseUrl + path);
  return { status: res.status, body: (await res.json()) as Envelope<T> };
}

const getSources = (path: string) => getJson<PublicCountryNewsSource[]>(path);
const getNews = (path: string) => getJson<PublicNewsListingResponse>(path);

function seedNewsSources(): void {
  for (const resource of [
    newsSource("ua-a", { name: "Kyiv Wire", sortOrder: 2 }),
    newsSource("ua-b", { name: "Dnipro Daily", sortOrder: 1 }),
    newsSource("ua-off", { name: "Lviv Closed", active: false }),
    newsSource("ua-norss", { name: "Odesa NoFeed", rssUrl: "not a url" }),
    newsSource("de-a", { name: "Berlin Post", countryCode: "DE" }),
    newsSource("world-a", { name: "World Desk", scopeType: "WORLD", countryCode: null }),
    newsSource("ua-trusted", { name: "Trusted Only", resourceType: "TRUSTED_MEDIA" }),
    newsSource("bbc-world", { name: "BBC World", scopeType: "COUNTRY", countryCode: "GB" }),
    newsSource("deutsche-welle", { name: "DW", scopeType: "COUNTRY", countryCode: "DE" }),
  ]) {
    upsertMediaResourceMemory(resource);
  }
}

before(async () => {
  setMediaResourceForceMemoryForTests(true);
  await ensureMediaResourcesSeededOnce();
  const app = express();
  app.use("/api/v1/public", countryStatisticsRouter);
  app.use("/api/v1/public/news", publicNewsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  seedNewsSources();
  await upsertPublicNewsRecords([
    article("kw-1", "Kyiv Wire", dayAt(1)),
    article("kw-2", "Kyiv Wire", dayAt(5)),
    article("dd-1", "Dnipro Daily", dayAt(3)),
    article("lc-1", "Lviv Closed", dayAt(9)),
    article("bp-1", "Berlin Post", dayAt(8)),
    article("kwx-1", "Kyiv Wire Extra", dayAt(7)),
    article("bbc-1", "BBC World", dayAt(6)),
  ]);
});

after(async () => {
  resetMediaResourcesMemoryForTests();
  resetPublicNewsMemoryStoreForTests();
  setMediaResourceForceMemoryForTests(false);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /api/v1/public/countries/:countryCode/news-sources", () => {
  it("lists only active country NEWS_SOURCE resources with a valid RSS URL, ordered", async () => {
    const { status, body } = await getSources("/api/v1/public/countries/UA/news-sources");
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(
      body.data.map((source: { name: string }) => source.name),
      ["Dnipro Daily", "Kyiv Wire"],
    );
    assert.equal(body.meta.countryCode, "UA");
    assert.equal(body.meta.count, 2);
  });

  it("exposes only id, name, providerId and language", async () => {
    const { body } = await getSources("/api/v1/public/countries/ua/news-sources");
    for (const source of body.data) {
      assert.deepEqual(Object.keys(source).sort(), ["id", "language", "name", "providerId"]);
    }
    const serialized = JSON.stringify(body);
    for (const secret of ["rss", "example.test", "Private admin", "sortOrder", "active"]) {
      assert.equal(serialized.includes(secret), false, secret);
    }
  });

  it("does not leak other countries, WORLD scope or other resource types", async () => {
    const de = await getSources("/api/v1/public/countries/DE/news-sources");
    assert.deepEqual(de.body.data.map((source: { name: string }) => source.name).sort(), [
      "Berlin Post",
      "DW",
    ]);
    const fr = await getSources("/api/v1/public/countries/FR/news-sources");
    assert.deepEqual(fr.body.data, []);
  });

  it("returns 404 for unknown countries", async () => {
    assert.equal((await getSources("/api/v1/public/countries/ZZ/news-sources")).status, 404);
    assert.equal(
      (await getSources("/api/v1/public/countries/not-a-country/news-sources")).status,
      404,
    );
  });
});

describe("GET /api/v1/public/news?sources= (exact source filter)", () => {
  it("matches exact names only, newest first, across multiple sources", async () => {
    const { status, body } = await getNews(
      "/api/v1/public/news?limit=50&sources=Kyiv%20Wire&sources=Dnipro%20Daily",
    );
    assert.equal(status, 200);
    assert.deepEqual(
      body.data.items.map((item: { id: string }) => item.id),
      ["kw-2", "dd-1", "kw-1"],
    );
    const comma = await getNews("/api/v1/public/news?limit=50&sources=Kyiv%20Wire,Dnipro%20Daily");
    assert.deepEqual(
      comma.body.data.items.map((item: { id: string }) => item.id),
      ["kw-2", "dd-1", "kw-1"],
    );
  });

  it("does not substring-match and is case-sensitive", async () => {
    const extra = await getNews("/api/v1/public/news?limit=50&sources=Kyiv%20Wire");
    assert.ok(!extra.body.data.items.some((item: { id: string }) => item.id === "kwx-1"));
    const lower = await getNews("/api/v1/public/news?limit=50&sources=kyiv%20wire");
    assert.deepEqual(lower.body.data.items, []);
    const partial = await getNews("/api/v1/public/news?limit=50&sources=Kyiv");
    assert.deepEqual(partial.body.data.items, []);
  });

  it("returns nothing for disabled or unknown sources", async () => {
    const disabled = await getNews("/api/v1/public/news?limit=50&sources=Lviv%20Closed");
    assert.equal(disabled.status, 200);
    assert.deepEqual(disabled.body.data.items, []);
    const unknown = await getNews("/api/v1/public/news?limit=50&sources=Nobody%20Media");
    assert.deepEqual(unknown.body.data.items, []);
  });

  it("applies the filter before the limit and keeps the 50 cap", async () => {
    await upsertPublicNewsRecords(
      Array.from({ length: 60 }, (_, i) =>
        article(
          `many-${i}`,
          "Dnipro Daily",
          `2031-02-${String((i % 28) + 1).padStart(2, "0")}T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
        ),
      ),
    );
    const capped = await getNews(
      "/api/v1/public/news?limit=500&sources=Kyiv%20Wire&sources=Dnipro%20Daily",
    );
    assert.equal(capped.body.data.items.length, 50);
    const two = await getNews("/api/v1/public/news?limit=2&sources=Kyiv%20Wire");
    assert.deepEqual(
      two.body.data.items.map((item: { id: string }) => item.id),
      ["kw-2", "kw-1"],
    );
  });

  it("rejects invalid input with 400", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `sources=S${i}`).join("&");
    assert.equal((await getNews(`/api/v1/public/news?${tooMany}`)).status, 400);
    assert.equal((await getNews("/api/v1/public/news?sources=")).status, 400);
    assert.equal((await getNews("/api/v1/public/news?sources=%20,%20")).status, 400);
    assert.equal((await getNews(`/api/v1/public/news?sources=${"x".repeat(121)}`)).status, 400);
    assert.throws(() => parsePublicNewsQuery({ sources: { a: "b" } }));
    assert.throws(() => parsePublicNewsQuery({ sources: ["Kyiv Wire", 1] }));
    assert.throws(() => parsePublicNewsQuery({ sources: "bad\u0007name" }));
  });

  it("keeps existing source= substring behaviour and the default listing", async () => {
    const substring = await getNews("/api/v1/public/news?limit=50&source=kyiv");
    assert.deepEqual(substring.body.data.items.map((item: { id: string }) => item.id).sort(), [
      "kw-1",
      "kw-2",
      "kwx-1",
    ]);
    const all = await getNews("/api/v1/public/news?limit=50");
    assert.equal(all.body.data.items.length, 7);
    assert.ok(Array.isArray(all.body.data.activeProviders));
    assert.equal(parsePublicNewsQuery({}).sources, undefined);
  });
});

describe("Country News translation alignment", () => {
  it("covers the newest articles of each active country source and active fallback source", async () => {
    const selected = await selectCountrySourceNewsArticles();
    const ids = new Set(selected.map((record) => record.id));
    for (const id of ["kw-1", "kw-2", "dd-1", "bp-1", "bbc-1"]) {
      assert.ok(ids.has(id), id);
    }
    assert.ok(!ids.has("lc-1"), "disabled source excluded");
    assert.ok(!ids.has("kwx-1"), "unconfigured source excluded");
    assert.equal(COUNTRY_NEWS_RAIL_LIMIT, 6);
    assert.deepEqual(listCountryNewsFallbackSourceNames(), [
      "BBC World",
      "DW",
      "France24",
      "Euronews",
      "The Guardian",
      "The New York Times",
    ]);
  });
});
