/**
 * Step 07C.2 — multilingual SEO canonical + hreflang core.
 *
 * Deterministic pure + request-adapter tests. No provider / CT / PLP.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PLATFORM_LANGUAGE,
  buildPublicSeoLocaleAlternatePaths,
  resolvePublicSeoDocumentSelfCanonicalPath,
} from "@hu/types";

import { buildPublicPageMetadata } from "../../lib/seo/build-public-page-metadata";
import { resolvePublicSeoMetadataDocumentPaths } from "../../lib/seo/build-public-page-metadata-for-request";
import {
  HREFLANG_STATUS,
  shouldEmitHreflangAlternates,
  shouldEmitXDefault,
  toNextMetadataLanguageAlternates,
} from "../../lib/seo/hreflang-policy";

function seoCatalog(
  rows: Array<{
    locale: string;
    seoIndexingEnabled: boolean;
    enabled?: boolean;
  }>,
) {
  return rows.map((row, index) => ({
    languageId: `lang-${row.locale}-${index}`,
    locale: row.locale,
    textDirection: "ltr" as const,
    aliases: [] as string[],
    enabled: row.enabled !== false,
    seoIndexingEnabled: row.seoIndexingEnabled,
  }));
}

describe("Step 07C.2 — multilingual SEO canonical + hreflang core", () => {
  it("policy is ACTIVE; perimeter gate replaces deferred stub", () => {
    assert.equal(HREFLANG_STATUS, "ACTIVE");
    assert.equal(shouldEmitHreflangAlternates("/initiatives"), true);
    assert.equal(shouldEmitXDefault("/media"), true);
    assert.equal(shouldEmitHreflangAlternates("/countries/CA"), false);
    assert.equal(shouldEmitHreflangAlternates("/search"), false);
  });

  it("1. locale-free path → self-canonical locale-free", () => {
    const path = resolvePublicSeoDocumentSelfCanonicalPath({
      localeFreePath: "/initiatives/public/init-1",
      isLocalePrefixedDocument: false,
      documentLocale: null,
    });
    assert.equal(path, "/initiatives/public/init-1");
  });

  it("2. valid SEO-prefixed document → self-canonical prefixed path", () => {
    const path = resolvePublicSeoDocumentSelfCanonicalPath({
      localeFreePath: "/initiatives/public/init-1",
      isLocalePrefixedDocument: true,
      documentLocale: "ka",
    });
    assert.equal(path, "/ka/initiatives/public/init-1");
  });

  it("3–7. hreflang alternates from SEO-indexable locales; English + x-default locale-free", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/media",
      seoIndexableLocales: ["en", "uk", "ar", "xx-SEOFUT"],
      defaultLocale: DEFAULT_PLATFORM_LANGUAGE,
    });
    assert.equal(result.emitLanguageAlternates, true);
    assert.equal(result.xDefaultPath, "/media");
    assert.equal(result.languagePaths.en, "/media");
    assert.equal(result.languagePaths.uk, "/uk/media");
    assert.equal(result.languagePaths.ar, "/ar/media");
    assert.equal(result.languagePaths["xx-SEOFUT"], "/xx-seofut/media");

    const languages = toNextMetadataLanguageAlternates(result);
    assert.ok(languages);
    assert.equal(languages!["x-default"], "/media");
    assert.equal(languages!.en, "/media");
    assert.equal(languages!.uk, "/uk/media");
  });

  it("4–5. SEO-disabled and disabled/absent locales excluded", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/blog/hello",
      // Caller filters; helper must not invent — only listed SEO locales.
      seoIndexableLocales: ["uk"],
      defaultLocale: "en",
    });
    assert.equal(result.languagePaths.uk, "/uk/blog/hello");
    assert.equal(result.languagePaths.en, "/blog/hello");
    assert.equal(result.languagePaths.ar, undefined);
    assert.equal(result.languagePaths.fr, undefined);
  });

  it("8. never emits /en/... prefixed paths", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/volunteer",
      seoIndexableLocales: ["en", "uk"],
      defaultLocale: "en",
    });
    for (const path of Object.values(result.languagePaths)) {
      assert.doesNotMatch(path, /^\/en(\/|$)/);
    }
    assert.equal(result.languagePaths.en, "/volunteer");

    const selfEn = resolvePublicSeoDocumentSelfCanonicalPath({
      localeFreePath: "/volunteer",
      isLocalePrefixedDocument: true,
      documentLocale: "en",
    });
    assert.equal(selfEn, "/volunteer");
  });

  it("9. outside PUBLIC_SEO_LOCALE_PATH_PATTERNS → no locale alternates", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/countries/CA",
      seoIndexableLocales: ["uk", "ar"],
    });
    assert.equal(result.emitLanguageAlternates, false);
    assert.deepEqual(result.languagePaths, {});
    assert.equal(toNextMetadataLanguageAlternates(result), null);
  });

  it("10. synthetic future locale works without application hardcoding", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/institutions",
      seoIndexableLocales: ["zz-FUTURE"],
    });
    assert.equal(result.languagePaths["zz-FUTURE"], "/zz-future/institutions");
  });

  it("11. empty catalog → no invented locale alternates (adapter)", async () => {
    const resolved = await resolvePublicSeoMetadataDocumentPaths({
      localeFreeCanonicalPath: "/media",
      catalog: [],
      pathname: "/media",
      urlLocaleSegment: null,
    });
    assert.equal(resolved.selfCanonicalPath, "/media");
    assert.equal(resolved.languageAlternates, null);
  });

  it("12. existing buildPublicPageMetadata non-multilingual behavior remains compatible", () => {
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
      assert.equal(
        meta.alternates?.canonical,
        "https://example.org/initiatives/public/init-1",
      );
      assert.equal(
        (meta.alternates as { languages?: unknown } | undefined)?.languages,
        undefined,
      );
      assert.equal(
        meta.openGraph?.url,
        "https://example.org/initiatives/public/init-1",
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

  it("13. Open Graph URL follows resolved self-canonical", () => {
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
    try {
      const meta = buildPublicPageMetadata({
        title: "Media",
        canonicalPath: "/uk/media",
        languageAlternates: {
          en: "https://example.org/media",
          uk: "https://example.org/uk/media",
          "x-default": "https://example.org/media",
        },
      });
      assert.equal(meta.alternates?.canonical, "https://example.org/uk/media");
      assert.equal(meta.openGraph?.url, "https://example.org/uk/media");
      assert.equal(
        (meta.alternates as { languages?: Record<string, string> }).languages?.uk,
        "https://example.org/uk/media",
      );
      assert.equal(
        (meta.alternates as { languages?: Record<string, string> }).languages?.[
          "x-default"
        ],
        "https://example.org/media",
      );
    } finally {
      if (prevOrigin === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = prevOrigin;
      }
    }
  });

  it("14. reserved blog/knowledge routes do not emit locale alternates", () => {
    const blogSubscribe = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/blog/subscribe",
      seoIndexableLocales: ["uk"],
    });
    assert.equal(blogSubscribe.emitLanguageAlternates, false);

    const knowledgeMedia = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/knowledge/media",
      seoIndexableLocales: ["uk"],
    });
    assert.equal(knowledgeMedia.emitLanguageAlternates, false);

    const blogArticle = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/blog/hello-world",
      seoIndexableLocales: ["uk"],
    });
    assert.equal(blogArticle.emitLanguageAlternates, true);
    assert.equal(blogArticle.languagePaths.uk, "/uk/blog/hello-world");
  });

  it("request adapter: SEO-prefixed pathname self-canonicalizes; filters SEO flags", async () => {
    const catalog = seoCatalog([
      { locale: "en", seoIndexingEnabled: true },
      { locale: "uk", seoIndexingEnabled: true },
      { locale: "ar", seoIndexingEnabled: false },
      { locale: "fr", seoIndexingEnabled: true, enabled: false },
      { locale: "xx-SEOFUT", seoIndexingEnabled: true },
    ]);

    const localeFree = await resolvePublicSeoMetadataDocumentPaths({
      localeFreeCanonicalPath: "/initiatives/public/abc",
      catalog,
      pathname: "/initiatives/public/abc",
      urlLocaleSegment: null,
    });
    assert.equal(localeFree.selfCanonicalPath, "/initiatives/public/abc");
    assert.ok(localeFree.languageAlternates);
    assert.equal(localeFree.languageAlternates!["x-default"], "/initiatives/public/abc");
    assert.equal(localeFree.languageAlternates!.en, "/initiatives/public/abc");
    assert.equal(localeFree.languageAlternates!.uk, "/uk/initiatives/public/abc");
    assert.equal(localeFree.languageAlternates!["xx-SEOFUT"], "/xx-seofut/initiatives/public/abc");
    assert.equal(localeFree.languageAlternates!.ar, undefined);
    assert.equal(localeFree.languageAlternates!.fr, undefined);
    assert.doesNotMatch(JSON.stringify(localeFree.languageAlternates), /\/en\//);

    const prefixed = await resolvePublicSeoMetadataDocumentPaths({
      localeFreeCanonicalPath: "/initiatives/public/abc",
      catalog,
      pathname: "/uk/initiatives/public/abc",
      urlLocaleSegment: "uk",
    });
    assert.equal(prefixed.selfCanonicalPath, "/uk/initiatives/public/abc");
    assert.equal(
      prefixed.languageAlternates!["x-default"],
      "/initiatives/public/abc",
    );
  });

  it("home `/` alternates use /{segment} not /{segment}/", () => {
    const result = buildPublicSeoLocaleAlternatePaths({
      localeFreePath: "/",
      seoIndexableLocales: ["uk"],
    });
    assert.equal(result.languagePaths.uk, "/uk");
    assert.equal(result.xDefaultPath, "/");
  });
});
