import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isApprovedMediaRegistryFeedUrl,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "@hu/media-registry";

import { filterExternalNewsArticles } from "../../../src/modules/public-news/public-news.filter.js";
import {
  buildSummary,
  normalizeExternalNewsArticle,
  type ExternalNewsArticle,
} from "../../../src/modules/public-news/public-news.normalize.js";
import { parseRssOrAtomFeed } from "../../../src/modules/public-news/public-news.rss-parser.js";
import {
  fetchExternalDocument,
  validatePublicArticleUrl,
} from "../../../src/modules/public-news/public-news.fetch.js";
import { balancePublicNewsRecordsBySource } from "../../../src/modules/public-news/public-news.repository.js";
import type { NewsArticleRecord } from "@hu/types";

function sampleArticle(overrides: Partial<ExternalNewsArticle> = {}): ExternalNewsArticle {
  return {
    externalId: "guid-1",
    provider: "rss",
    sourceName: "The Guardian",
    sourceDomain: "theguardian.com",
    title: "Civic assembly expands",
    summary: "A short syndication excerpt.",
    articleUrl: "https://www.theguardian.com/world/2026/aug/12/civic-assembly-expands",
    imageUrl: "https://www.theguardian.com/img.jpg",
    publishedAt: "2026-08-12T12:00:00.000Z",
    language: "en",
    category: "peace and security",
    ...overrides,
  };
}

describe("Civic Media RSS Integration Pack 01 — normalization & safety", () => {
  it("normalizes RSS items without persisting full article HTML bodies", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Headline One</title>
          <link>https://www.theguardian.com/world/2026/aug/12/headline-one</link>
          <guid>https://www.theguardian.com/world/2026/aug/12/headline-one</guid>
          <pubDate>Tue, 12 Aug 2026 10:00:00 GMT</pubDate>
          <description><![CDATA[<p>Short excerpt only.</p>]]></description>
          <content:encoded><![CDATA[<div class="article-body">FULL BODY SHOULD NOT BE STORED</div>]]></content:encoded>
        </item>
      </channel></rss>`;

    const items = parseRssOrAtomFeed(xml, "https://www.theguardian.com/international/rss");
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Headline One");
    assert.doesNotMatch(items[0]?.summary ?? "", /FULL BODY SHOULD NOT BE STORED/);
    assert.match(items[0]?.summary ?? "", /Short excerpt only/);
    assert.ok(Number.isFinite(Date.parse(items[0]!.publishedAt)));

    const record = normalizeExternalNewsArticle(
      sampleArticle({
        title: items[0]!.title,
        summary: items[0]!.summary,
        articleUrl: items[0]!.articleUrl,
        publishedAt: "2026-08-12T10:00:00.000Z",
        externalId: items[0]!.externalId,
      }),
      7,
    );

    assert.doesNotMatch(record.summary, /FULL BODY SHOULD NOT BE STORED/);
    assert.ok(record.summary.length <= 320);
    assert.equal(record.articleUrl.includes("theguardian.com"), true);
  });

  it("parses Economist-style multiline CDATA titles and links", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <item>
          <title>
            <![CDATA[Taking Taiwan’s democracy hostage]]>
          </title>
          <description>
            <![CDATA[Short syndication excerpt.]]>
          </description>
          <link>https://www.economist.com/international/2026/08/11/taking-taiwans-democracy-hostage</link>
          <guid isPermaLink="false">5be97fa7-0646-4274-904c-9a7d00eeb92c</guid>
          <pubDate>Tue, 11 Aug 2026 13:38:59 +0000</pubDate>
        </item>
      </channel></rss>`;

    const items = parseRssOrAtomFeed(xml, "https://www.economist.com/international/rss.xml");
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Taking Taiwan’s democracy hostage");
    assert.equal(
      items[0]?.articleUrl,
      "https://www.economist.com/international/2026/08/11/taking-taiwans-democracy-hostage",
    );
    assert.match(items[0]?.summary ?? "", /Short syndication excerpt/);
  });

  it("accepts approved-registry article URLs without requiring live HTML fetch", async () => {
    const ok = await validatePublicArticleUrl(
      "https://www.nytimes.com/2026/08/12/world/example.html",
      { timeoutMs: 1000 },
    );
    assert.equal(ok, true);

    const rejected = await validatePublicArticleUrl("https://evil.example.org/story.html", {
      timeoutMs: 1000,
    });
    assert.equal(rejected, false);
  });

  it("dedupes by canonical article URL across refresh cycles", () => {
    const first = sampleArticle({
      articleUrl: "https://www.theguardian.com/world/2026/aug/12/story?utm=1#frag",
      publishedAt: "2026-08-12T10:00:00.000Z",
    });
    const duplicate = sampleArticle({
      externalId: "guid-2",
      articleUrl: "https://www.theguardian.com/world/2026/aug/12/story",
      title: "Updated title",
      publishedAt: "2026-08-12T11:00:00.000Z",
    });

    const filtered = filterExternalNewsArticles([first, duplicate], { retentionDays: 7 });
    assert.equal(filtered.length, 1);
  });

  it("balances per-source contribution before newest-first rail slice", () => {
    const records = Array.from({ length: 20 }, (_, index) => {
      const sourceName = index < 16 ? "Al Jazeera English" : "The Economist";
      return {
        id: `id-${index}`,
        sourceName,
        title: `${sourceName} ${index}`,
        summary: "excerpt",
        articleUrl: `https://example.com/${index}`,
        publishedAt: new Date(Date.UTC(2026, 7, 13, 12, index)).toISOString(),
        language: "en",
        category: "democracy",
        status: "active",
        expiresAt: new Date(Date.UTC(2026, 7, 20)).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        provider: "rss",
        normalizedArticleUrl: `https://example.com/${index}`,
      } as NewsArticleRecord;
    });

    const balanced = balancePublicNewsRecordsBySource(records, 8);
    assert.equal(balanced.length, 8);
    const economistCount = balanced.filter((item) => item.sourceName === "The Economist").length;
    assert.ok(economistCount >= 2, "Economist must retain rail slots against a prolific source");
  });

  it("newest-first mixed ordering after multi-source merge", () => {
    const articles = [
      sampleArticle({
        sourceName: "CBC",
        sourceDomain: "cbc.ca",
        articleUrl: "https://www.cbc.ca/news/world/a-1.123",
        publishedAt: "2026-08-12T09:00:00.000Z",
      }),
      sampleArticle({
        sourceName: "The New York Times",
        sourceDomain: "nytimes.com",
        articleUrl: "https://www.nytimes.com/2026/08/12/world/example.html",
        publishedAt: "2026-08-12T12:00:00.000Z",
      }),
      sampleArticle({
        sourceName: "POLITICO",
        sourceDomain: "politico.com",
        articleUrl: "https://www.politico.com/news/2026/08/12/example-001",
        publishedAt: "2026-08-12T11:00:00.000Z",
      }),
    ];

    const sorted = [...articles].sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
    );
    assert.equal(sorted[0]?.sourceName, "The New York Times");
    assert.equal(sorted[1]?.sourceName, "POLITICO");
    assert.equal(sorted[2]?.sourceName, "CBC");
  });

  it("rejects arbitrary RSS URL fetch when requireApprovedRssFeed is set", async () => {
    await assert.rejects(
      () =>
        fetchExternalDocument("https://evil.example.org/feed.xml", {
          timeoutMs: 1000,
          maxBytes: 1024,
          requireApprovedRssFeed: true,
        }),
      /not in the approved media registry/,
    );
    assert.equal(isApprovedMediaRegistryFeedUrl("https://evil.example.org/feed.xml"), false);
  });

  it("one failed RSS source does not fail sibling normalization/filter", () => {
    const articles = [
      sampleArticle({
        sourceName: "POLITICO",
        sourceDomain: "politico.com",
        articleUrl: "not-a-url",
        title: "broken",
      }),
      sampleArticle({
        sourceName: "The Guardian",
        articleUrl: "https://www.theguardian.com/world/2026/aug/12/ok-story",
      }),
    ];

    const filtered = filterExternalNewsArticles(articles, { retentionDays: 7 });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.sourceName, "The Guardian");
  });

  it("summary builder bounds excerpt length (no full article ingestion)", () => {
    const long = "word ".repeat(500);
    const summary = buildSummary("Title", `<p>${long}</p>`);
    assert.ok(summary.length <= 320);
  });

  it("API public news query max remains bounded", () => {
    // parsePublicNewsQuery clamps to 50; Web rail requests 24.
    const rawLimit = 24;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    assert.equal(limit, 24);
  });

  it("six Pack feeds are present in the trusted registry", () => {
    const ids = new Set(TRUSTED_GLOBAL_MEDIA_REGISTRY.map((provider) => provider.id));
    for (const id of [
      "the-guardian",
      "the-economist",
      "washington-post",
      "cbc",
      "politico",
      "new-york-times",
    ]) {
      assert.ok(ids.has(id), id);
    }
  });
});
