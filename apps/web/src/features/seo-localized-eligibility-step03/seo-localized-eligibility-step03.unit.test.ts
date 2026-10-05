/**
 * Search/SEO 3A–3F — page-specific localized eligibility, hreflang, sitemap,
 * canonical locale normalization, and Admin Search-ready.
 * Fixtures only. No live Registry and no staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPublicSeoLocalePath } from "@hu/types";

import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";
import { selectCanonicalEnglishSeoOverrideForDocument } from "../../lib/seo/apply-page-seo-override";
import { resolveCanonicalPublicSeoLocalePathname } from "../../lib/seo/public-seo-locale-canonical-redirect";
import {
  classifyPublicSeoLocalizedPageFamily,
  isPublicSeoLocalizedVariantEligible,
  type PublicSeoLocalizedPageEvidence,
} from "../../lib/seo/public-seo-localized-eligibility";
import { expandPublicSitemapEntriesForSeoLocales } from "../../lib/seo/sitemap/expand-public-sitemap-for-seo-locales";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function evidence(
  patch: Partial<PublicSeoLocalizedPageEvidence> = {},
): PublicSeoLocalizedPageEvidence {
  return {
    webUiPublished: false,
    brandPublishedForLocale: false,
    legalPrivacyPublished: false,
    legalTermsPublished: false,
    civicMediaCurrent: false,
    entityCurrent: false,
    ...patch,
  };
}

const CURRENT = evidence({
  webUiPublished: true,
  brandPublishedForLocale: true,
  legalPrivacyPublished: true,
  legalTermsPublished: true,
  civicMediaCurrent: true,
  entityCurrent: true,
});

function eligible(localeFreePath: string, pageEvidence: PublicSeoLocalizedPageEvidence): boolean {
  return isPublicSeoLocalizedVariantEligible({
    localeFreePath,
    evidence: pageEvidence,
  });
}

function catalog() {
  return [
    {
      languageId: "en",
      locale: "en",
      textDirection: "ltr" as const,
      aliases: ["en-US"],
      enabled: true,
      seoIndexingEnabled: false,
    },
    {
      languageId: "uk",
      locale: "uk",
      textDirection: "ltr" as const,
      aliases: ["uk-UA"],
      enabled: true,
      seoIndexingEnabled: true,
    },
    {
      languageId: "zh",
      locale: "zh-Hant",
      textDirection: "ltr" as const,
      aliases: ["zh-TW", "zh-HK"],
      enabled: true,
      seoIndexingEnabled: true,
    },
    {
      languageId: "future",
      locale: "zz-Future",
      textDirection: "ltr" as const,
      aliases: ["zz-FUT"],
      enabled: true,
      seoIndexingEnabled: true,
    },
  ];
}

describe("Search/SEO page-specific localized eligibility", () => {
  it("CURRENT evidence makes owner pages eligible, including a future locale", () => {
    for (const path of [
      "/",
      "/institutions",
      "/initiatives",
      "/initiatives/public/init-1",
      "/blog",
      "/blog/hello",
      "/media",
      "/knowledge",
      "/volunteer",
      "/contact",
      "/membership",
      "/privacy",
      "/terms",
    ]) {
      assert.equal(eligible(path, CURRENT), true, path);
    }
    assert.equal(classifyPublicSeoLocalizedPageFamily("/volunteer"), "volunteer");
    assert.equal(eligible("/institutions", CURRENT), true);
  });

  it("STALE owner evidence is not advertised as a current localized document", () => {
    const stale = evidence({
      webUiPublished: true,
      legalPrivacyPublished: false,
      legalTermsPublished: false,
      civicMediaCurrent: false,
      entityCurrent: false,
      brandPublishedForLocale: false,
    });
    assert.equal(eligible("/privacy", stale), false);
    assert.equal(eligible("/terms", stale), false);
    assert.equal(eligible("/media", stale), false);
    assert.equal(eligible("/initiatives/public/init-1", stale), false);
    assert.equal(eligible("/blog/hello", stale), false);
    assert.equal(eligible("/", stale), false);
  });

  it("MISSING localized representation does not create a localized indexable document", () => {
    const missing = evidence();
    assert.equal(eligible("/uk", missing), false);
    assert.equal(eligible("/", missing), false);
    assert.equal(eligible("/volunteer", missing), false);
    assert.equal(eligible("/blog/hello", missing), false);
    assert.equal(eligible("/initiatives/public/init-1", missing), false);
  });

  it("knowledge articles stay locale-free because the body has no translation owner", () => {
    assert.equal(classifyPublicSeoLocalizedPageFamily("/knowledge/guide"), "knowledge_article");
    assert.equal(eligible("/knowledge/guide", CURRENT), false);
    assert.equal(eligible("/knowledge", CURRENT), true);
    assert.equal(isPublicSeoLocalePath("/support"), false);
    assert.equal(classifyPublicSeoLocalizedPageFamily("/support"), "unsupported");
  });

  it("future locale uses the same eligibility function", () => {
    assert.equal(eligible("/contact", CURRENT), true);
    assert.equal(
      eligible("/contact", evidence({ webUiPublished: false })),
      false,
    );
    const expanded = expandPublicSitemapEntriesForSeoLocales({
      entries: [
        { path: "/contact" },
        { path: "/knowledge/guide" },
        { path: "/volunteer" },
      ],
      seoIndexableLocales: ["zz-Future"],
      isLocalizedVariantEligible: (localeFreePath) => eligible(localeFreePath, CURRENT),
    });
    const paths = expanded.map((entry) => entry.path);
    assert.ok(paths.includes("/contact"));
    assert.ok(paths.includes("/zz-future/contact"));
    assert.ok(paths.includes("/volunteer"));
    assert.ok(paths.includes("/zz-future/volunteer"));
    assert.ok(paths.includes("/knowledge/guide"));
    assert.ok(!paths.includes("/zz-future/knowledge/guide"));
  });

  it("hreflang includes only eligible localized documents and stays reciprocal", async () => {
    const predicate = (localeFreePath: string, locale: string) =>
      locale === "uk" && localeFreePath === "/blog/hello"
        ? false
        : locale === "zz-Future" || locale === "zh-Hant" || locale === "uk";

    const english = await buildPublicPageMetadataForRequest({
      title: "Hello",
      canonicalPath: "/blog/hello",
      localeFreeCanonicalPath: "/blog/hello",
      catalog: catalog(),
      pathname: "/blog/hello",
      isLocalizedVariantEligible: (localeFreePath, locale) =>
        localeFreePath === "/blog/hello" && predicate(localeFreePath, locale),
    });
    const localized = await buildPublicPageMetadataForRequest({
      title: "Hello",
      canonicalPath: "/blog/hello",
      localeFreeCanonicalPath: "/blog/hello",
      catalog: catalog(),
      pathname: "/zh-Hant/blog/hello",
      urlLocaleSegment: "zh-Hant",
      isLocalizedVariantEligible: (localeFreePath, locale) =>
        localeFreePath === "/blog/hello" && predicate(localeFreePath, locale),
    });

    const englishLanguages = english.alternates?.languages ?? {};
    const localizedLanguages = localized.alternates?.languages ?? {};
    assert.equal(englishLanguages.en, englishLanguages["x-default"]);
    assert.equal(localizedLanguages["zh-Hant"], localized.alternates?.canonical);
    assert.equal(englishLanguages.uk, undefined);
    assert.equal(localizedLanguages.uk, undefined);
    assert.equal(englishLanguages["zh-Hant"], localizedLanguages["zh-Hant"]);
    assert.equal(englishLanguages["zz-Future"], localizedLanguages["zz-Future"]);
    assert.equal(englishLanguages["x-default"], localizedLanguages["x-default"]);
  });

  it("missing localized blog canonicalizes to English and is not indexable in production", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
    try {
      const meta = await buildPublicPageMetadataForRequest({
        title: "Hello",
        description: "Canonical English summary",
        canonicalPath: "/blog/hello",
        localeFreeCanonicalPath: "/blog/hello",
        catalog: catalog(),
        pathname: "/uk/blog/hello",
        urlLocaleSegment: "uk",
        isLocalizedVariantEligible: () => false,
      });
      assert.equal(meta.alternates?.canonical, "https://huws.org/blog/hello");
      assert.equal(meta.robots && typeof meta.robots === "object" ? meta.robots.index : null, false);
      assert.equal(meta.alternates?.languages?.uk, undefined);
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

  it("staging noindex remains even when a localized variant is eligible", async () => {
    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
    try {
      const meta = await buildPublicPageMetadataForRequest({
        title: "Hello",
        canonicalPath: "/blog/hello",
        localeFreeCanonicalPath: "/blog/hello",
        catalog: catalog(),
        pathname: "/zh-hant/blog/hello",
        urlLocaleSegment: "zh-hant",
        isLocalizedVariantEligible: () => true,
      });
      assert.equal(meta.robots && typeof meta.robots === "object" ? meta.robots.index : null, false);
      assert.equal(meta.robots && typeof meta.robots === "object" ? meta.robots.follow : null, false);
    } finally {
      if (prevMode === undefined) {
        delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      } else {
        process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      }
    }
  });

  it("normalizes recognized locale aliases and case to the canonical segment", () => {
    const rows = catalog();
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/zh-Hant/blog",
        catalog: rows,
      }),
      "/zh-hant/blog",
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/zh-TW/initiatives/public/init-1",
        catalog: rows,
      }),
      "/zh-hant/initiatives/public/init-1",
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/ZZ-FUT/volunteer",
        catalog: rows,
      }),
      "/zz-future/volunteer",
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/en-US/contact",
        catalog: rows,
      }),
      "/contact",
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/zh-hant/blog",
        catalog: rows,
      }),
      null,
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/support",
        catalog: rows,
      }),
      null,
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/not-a-locale/blog",
        catalog: rows,
      }),
      null,
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/admin/languages",
        catalog: rows,
      }),
      null,
    );
    assert.equal(
      resolveCanonicalPublicSeoLocalePathname({
        pathname: "/zh-Hant/blog",
        catalog: null,
      }),
      null,
    );
  });

  it("keeps the English volunteer override off locale-prefixed documents", () => {
    const override = {
      seoTitle: "Volunteer with Humanity Union",
      seoDescription: "Volunteer description",
    };
    assert.deepEqual(selectCanonicalEnglishSeoOverrideForDocument(false, override), override);
    assert.equal(selectCanonicalEnglishSeoOverrideForDocument(true, override), null);
  });

  it("Admin Search-ready is enabled and searchEnabled", () => {
    const section = readWeb("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(
      section,
      /Search-ready:[\s\S]*report\.registry\.enabled === true && report\.registry\.searchEnabled === true/,
    );
    assert.doesNotMatch(section, /searchLocalizationReady/);
    const proxy = readWeb("proxy.ts");
    assert.match(proxy, /resolveCanonicalPublicSeoLocalePathname/);
    assert.match(proxy, /NextResponse\.redirect/);
    const sitemap = readWeb("lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(sitemap, /buildPublicSeoLocalizedVariantPredicate/);
  });
});
