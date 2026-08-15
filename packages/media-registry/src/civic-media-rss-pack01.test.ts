import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveApprovedNewsSources,
  getMediaRegistryProviderById,
  getMediaRegistryProviderByName,
  isApprovedMediaRegistryFeedUrl,
  isSpecificMediaArticleUrl,
  listApprovedMediaRegistryFeedUrls,
  listEnabledMediaRegistryProviders,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "./media-registry.js";

const webPublicMedia = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/web/public/images/media",
);

const RSS_PACK_SOURCES = [
  {
    id: "the-guardian",
    name: "The Guardian",
    feedUrl: "https://www.theguardian.com/international/rss",
    logoPath: "/images/media/guardian.webp",
    assetRelative: "guardian.webp",
  },
  {
    id: "the-economist",
    name: "The Economist",
    feedUrl: "https://www.economist.com/international/rss.xml",
    logoPath: "/images/media/the-economist.webp",
    assetRelative: "the-economist.webp",
  },
  {
    id: "washington-post",
    name: "The Washington Post",
    feedUrl: "https://feeds.washingtonpost.com/rss/opinions",
    logoPath: "/images/media/wpost.webp",
    assetRelative: "wpost.webp",
  },
  {
    id: "cbc",
    name: "CBC",
    feedUrl: "https://www.cbc.ca/webfeed/rss/rss-world",
    logoPath: "/images/media/canada/cbc.webp",
    assetRelative: "canada/cbc.webp",
  },
  {
    id: "politico",
    name: "POLITICO",
    feedUrl: "https://www.politico.com/rss/politicopicks.xml",
    logoPath: undefined,
    assetRelative: undefined,
  },
  {
    id: "new-york-times",
    name: "The New York Times",
    feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    logoPath: "/images/media/nytimes.webp",
    assetRelative: "nytimes.webp",
  },
] as const;

describe("Civic Media RSS Integration Pack 01 — registry feeds", () => {
  for (const source of RSS_PACK_SOURCES) {
    it(`${source.name} maps to canonical registry id + feed`, () => {
      const provider = getMediaRegistryProviderById(source.id);
      assert.ok(provider, `${source.id} must exist`);
      assert.equal(provider.name, source.name);
      assert.equal(provider.rssFeeds[0]?.url, source.feedUrl);
      assert.notEqual(provider.rssEnabled, false);
      assert.equal(getMediaRegistryProviderByName(source.name)?.id, source.id);
    });
  }

  it("correct source logos resolve to existing assets or intentional omission", () => {
    for (const source of RSS_PACK_SOURCES) {
      const provider = getMediaRegistryProviderById(source.id);
      assert.ok(provider);
      assert.equal(provider.logoUrl, source.logoPath);
      if (source.assetRelative) {
        assert.ok(
          existsSync(path.join(webPublicMedia, source.assetRelative)),
          `missing asset ${source.assetRelative}`,
        );
      } else {
        assert.equal(provider.logoUrl, undefined);
        assert.ok(provider.logoLabel.length > 0);
      }
    }
  });

  it("canonical text fallback when logo missing (POLITICO)", () => {
    const politico = getMediaRegistryProviderById("politico");
    assert.equal(politico?.logoUrl, undefined);
    assert.equal(politico?.logoLabel, "POL");
    assert.equal(getMediaRegistryProviderById("the-economist")?.logoUrl, "/images/media/the-economist.webp");
  });

  it("approved feed allow-list rejects arbitrary client RSS URLs", () => {
    assert.equal(isApprovedMediaRegistryFeedUrl("https://evil.example/rss.xml"), false);
    assert.equal(
      isApprovedMediaRegistryFeedUrl("https://www.theguardian.com/international/rss"),
      true,
    );
    assert.ok(listApprovedMediaRegistryFeedUrls().length >= 6);
  });

  it("article URL specificity accepts publisher article paths", () => {
    const guardian = getMediaRegistryProviderById("the-guardian");
    assert.equal(
      isSpecificMediaArticleUrl(
        "https://www.theguardian.com/world/2026/aug/12/sample-story",
        guardian,
      ),
      true,
    );
    assert.equal(
      isSpecificMediaArticleUrl("https://www.theguardian.com/international", guardian),
      false,
    );
  });

  it("France24 and Euronews no longer share the trust.webp placeholder hash target", () => {
    const france = getMediaRegistryProviderById("france24");
    const euro = getMediaRegistryProviderById("euronews");
    assert.equal(france?.logoUrl, "/images/media/france24.webp");
    assert.equal(euro?.logoUrl, "/images/media/euronews.webp");
    assert.ok(existsSync(path.join(webPublicMedia, "france24.webp")));
    assert.ok(existsSync(path.join(webPublicMedia, "euronews.webp")));
    // trust.webp remains the known duplicate placeholder asset; active logos must not point to it.
    for (const provider of listEnabledMediaRegistryProviders()) {
      assert.notEqual(provider.logoUrl, "/images/media/trust.webp");
    }
  });

  it("derived approved news sources include the six RSS pack feeds", () => {
    const feeds = new Set(deriveApprovedNewsSources().map((source) => source.rssFeedUrl));
    for (const source of RSS_PACK_SOURCES) {
      assert.ok(feeds.has(source.feedUrl), source.feedUrl);
    }
  });

  it("registry remains the single logo-resolution source of truth", () => {
    // No duplicate publication IDs.
    const ids = TRUSTED_GLOBAL_MEDIA_REGISTRY.map((provider) => provider.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
