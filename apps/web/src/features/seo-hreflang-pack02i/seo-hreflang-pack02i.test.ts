/**
 * Pack 02I / Step 07C.2 — hreflang policy is ACTIVE for Pack 2.1 SEO perimeter.
 * Sitemap remains locale-free until a later multilingual sitemap step.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import {
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

describe("SEO Pack 02I / Step 07C.2 — hreflang ACTIVE for SEO perimeter", () => {
  it("shouldEmitHreflangAlternates is perimeter-gated; status is ACTIVE", () => {
    assert.equal(HREFLANG_STATUS, "ACTIVE");
    assert.equal(shouldEmitHreflangAlternates("/media"), true);
    assert.equal(shouldEmitXDefault("/media"), true);
    assert.equal(shouldEmitHreflangAlternates("/countries/CA"), false);
    assert.equal(shouldEmitXDefault("/search"), false);
  });

  it("buildPublicPageMetadata omits languages unless provided (backward compatible)", () => {
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

  it("buildPublicPageMetadata emits languages when the adapter supplies them", () => {
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata({
        title: "Climate Action",
        canonicalPath: "/uk/initiatives/public/init-1",
        languageAlternates: {
          en: "/initiatives/public/init-1",
          uk: "/uk/initiatives/public/init-1",
          "x-default": "/initiatives/public/init-1",
        },
      });
      const languages = (meta.alternates as { languages?: Record<string, string> })
        .languages;
      assert.equal(languages?.en, "https://example.org/initiatives/public/init-1");
      assert.equal(languages?.uk, "https://example.org/uk/initiatives/public/init-1");
      assert.equal(languages?.["x-default"], "https://example.org/initiatives/public/init-1");
      assert.equal(meta.openGraph?.url, "https://example.org/uk/initiatives/public/init-1");
      assert.doesNotMatch(JSON.stringify(languages), /\/en\//);
    } finally {
      if (prevOrigin === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = prevOrigin;
      }
    }
  });

  it("metadata builder remains sync and does not hardcode production locales", () => {
    const builder = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.doesNotMatch(builder, /\/uk\//);
    assert.doesNotMatch(builder, /fetch\(|listLanguageRegistry|TranslationProvider/);
    assert.match(builder, /languageAlternates/);

    const policy = readWeb("lib/seo/hreflang-policy.ts");
    assert.match(policy, /HREFLANG_STATUS\s*=\s*"ACTIVE"/);
    assert.match(policy, /shouldEmitHreflangAlternates/);
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

  it("Initiative generateMetadata uses cache-only CT + request-aware canonical/hreflang", () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /resolveLocalizedPublicMetadataCopy/);
    assert.match(page, /loadInitiativeMetadataTranslationFields/);
    assert.doesNotMatch(page, /generateContentTranslation/);
    assert.match(page, /localeFreeCanonicalPath\s*=\s*`\/initiatives\/public\//);
    assert.match(page, /buildPublicPageMetadataForRequest/);
  });
});

describe("SEO Pack 02I / Step 07E — static inventory locale-free; expansion is Registry-driven", () => {
  it("static sitemap provider entries are locale-free (expansion applied later)", () => {
    const entries = listStaticPublicSitemapEntries();
    assert.ok(entries.length > 0);
    for (const entry of entries) {
      assert.doesNotMatch(entry.path, /^\/(uk|ar|zh-Hant|en)\//);
      assert.doesNotMatch(entry.path, /[?&]lang=/i);
      assert.doesNotMatch(entry.path, /[?&]locale=/i);
    }
  });

  it("canonical-only collect (empty SEO locales) does not invent locale prefixes", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const paths = await collectPublicSitemapPathEntries({
        includeDynamicProviders: false,
        seoIndexableLocales: [],
      });
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
