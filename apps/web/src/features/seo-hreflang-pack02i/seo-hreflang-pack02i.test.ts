/**
 * Pack 02I — Hreflang deferred; no invented locale-prefixed alternates.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import {
  HREFLANG_DEFERRED_REASON,
  HREFLANG_STATUS,
  shouldEmitHreflangAlternates,
  shouldEmitXDefault,
} from "../../lib/seo/hreflang-policy";
import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";
import {
  collectPublicSitemapPathEntries,
  toMetadataRouteSitemap,
} from "../../lib/seo/sitemap/build-public-sitemap";
import { listStaticPublicSitemapEntries } from "../../lib/seo/sitemap/providers/static-public-pages";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 02I — hreflang deferred", () => {
  it("shouldEmitHreflangAlternates() === false and status is DEFERRED", () => {
    assert.equal(shouldEmitHreflangAlternates(), false);
    assert.equal(shouldEmitXDefault(), false);
    assert.equal(HREFLANG_STATUS, "DEFERRED");
    assert.match(HREFLANG_DEFERRED_REASON, /locale-addressable|misleading|cookie/i);
  });

  it("buildPublicPageMetadata does not set alternates.languages", () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata({
        title: "Climate Action",
        description: "A public Initiative",
        canonicalPath: "/initiatives/public/init-1",
      });
      assert.equal(meta.alternates?.canonical, "https://example.org/initiatives/public/init-1");
      assert.equal(
        (meta.alternates as { languages?: unknown } | undefined)?.languages,
        undefined,
      );
      assert.doesNotMatch(JSON.stringify(meta), /"uk"\s*:/);
      assert.doesNotMatch(JSON.stringify(meta), /\/uk\//);
    } finally {
      if (prevMode === undefined) {
        delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      } else {
        process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      }
      if (prevOrigin === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = prevOrigin;
      }
    }
  });

  it("metadata builder source does not invent /uk/ paths or hreflang maps", () => {
    const builder = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.doesNotMatch(builder, /\/uk\//);
    assert.doesNotMatch(builder, /hreflang|alternates\.languages|languages:\s*\{/);
    assert.doesNotMatch(builder, /x-default|xDefault/);

    const policy = readWeb("lib/seo/hreflang-policy.ts");
    assert.match(policy, /HREFLANG_DEFERRED|HREFLANG_STATUS/);
    assert.match(policy, /shouldEmitHreflangAlternates\(\):\s*false/);
    assert.match(policy, /shouldEmitXDefault\(\):\s*false/);
  });

  it("html lang still resolved separately in layout (not via hreflang)", () => {
    const layout = readWeb("app/layout.tsx");
    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.match(layout, /lang=\{documentLocale\.locale\}/);
    assert.doesNotMatch(layout, /hreflang|alternates\.languages/);
  });

  it("localized metadata copy never invents locale paths", () => {
    const copy = resolveLocalizedPublicMetadataCopy({
      title: "Canonical",
      description: "Canonical description",
      locale: "uk",
      translatedTitle: "Канонічний",
      translatedDescription: "Опис",
    });
    assert.equal(copy.title, "Канонічний");
    assert.equal(copy.description, "Опис");
    assert.equal(copy.locale, "uk");
    assert.equal(copy.usedTranslation, true);

    const builder = readWeb("lib/seo/resolve-localized-public-metadata-copy.ts");
    assert.doesNotMatch(builder, /\/uk\//);
    assert.doesNotMatch(builder, /generateContentTranslation/);
    assert.match(builder, /NEVER calls Gemini/i);
  });

  it("Initiative generateMetadata uses cache-only translation helper", () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /resolveLocalizedPublicMetadataCopy/);
    assert.match(page, /loadInitiativeMetadataTranslationFields/);
    assert.doesNotMatch(page, /generateContentTranslation/);
    assert.doesNotMatch(page, /\/uk\//);
    assert.match(page, /canonicalPath\s*=\s*`\/initiatives\/public\//);
  });
});

describe("SEO Pack 02I — canonical / sitemap remain locale-free", () => {
  it("static sitemap entries are one URL per entity without locale prefixes", () => {
    const entries = listStaticPublicSitemapEntries();
    assert.ok(entries.length > 0);
    for (const entry of entries) {
      assert.doesNotMatch(entry.path, /^\/(uk|ar|zh-Hant|en)\//);
      assert.doesNotMatch(entry.path, /[?&]lang=/i);
      assert.doesNotMatch(entry.path, /[?&]locale=/i);
    }
  });

  it("toMetadataRouteSitemap does not invent locale query/path prefixes", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const paths = await collectPublicSitemapPathEntries({ includeDynamicProviders: false });
      const sitemap = toMetadataRouteSitemap(paths, "https://example.org");
      assert.ok(sitemap.length > 0);
      for (const row of sitemap) {
        assert.doesNotMatch(row.url, /\/uk\//);
        assert.doesNotMatch(row.url, /[?&]lang=/i);
        assert.doesNotMatch(row.url, /[?&]locale=/i);
      }
    } finally {
      if (prevMode === undefined) {
        delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      } else {
        process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      }
      if (prevOrigin === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = prevOrigin;
      }
    }
  });
});
