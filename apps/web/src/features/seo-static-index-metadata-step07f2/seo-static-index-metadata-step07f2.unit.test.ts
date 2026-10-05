/**
 * Step 07F.2 — static/index public SEO metadata via WEB_UI / Brand + ForRequest.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPublicSeoLocalePath } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";
import { normalizeMetaDescription } from "../../lib/seo/normalize-seo-text";
import { STATIC_PUBLIC_SITEMAP_PATHS } from "../../lib/seo/sitemap/providers/static-public-pages";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function seoCatalog(
  rows: Array<{ locale: string; seoIndexingEnabled: boolean; enabled?: boolean }>,
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

const CATALOG = seoCatalog([
  { locale: "en", seoIndexingEnabled: true },
  { locale: "uk", seoIndexingEnabled: true },
  { locale: "ar", seoIndexingEnabled: false },
  { locale: "xx-SEOFUT", seoIndexingEnabled: true },
]);

type Nested = Record<string, unknown>;

function nest(messages: Nested, key: string): Nested {
  const value = messages[key];
  assert.ok(value && typeof value === "object", `missing catalog namespace ${key}`);
  return value as Nested;
}

function str(obj: Nested, key: string): string {
  const value = obj[key];
  assert.equal(typeof value, "string", `expected string ${key}`);
  return value as string;
}

function interpolateSiteName(template: string, siteName: string): string {
  return template.replaceAll("{siteName}", siteName);
}

describe("Step 07F.2 — static/index public SEO metadata", () => {
  it("architecture: in-scope routes use ForRequest; Home/Media unchanged; no CT/readiness", () => {
    const routes: Array<{ file: string; ns: string; titleKey: string; descKey: string }> = [
      { file: "app/blog/page.tsx", ns: "blogPublic", titleKey: "pageTitle", descKey: "pageSubtitle" },
      {
        file: "app/initiatives/page.tsx",
        ns: "worldInitiativesPublic",
        titleKey: "pageTitle",
        descKey: "pageIntro",
      },
      {
        file: "app/institutions/page.tsx",
        ns: "institutionsPublic",
        titleKey: "headline",
        descKey: "subheadline",
      },
      {
        file: "app/knowledge/page.tsx",
        ns: "knowledgePublic",
        titleKey: "pageTitle",
        descKey: "pageIntro",
      },
      {
        file: "app/volunteer/page.tsx",
        ns: "volunteerPublic",
        titleKey: "title",
        descKey: "lead",
      },
      {
        file: "app/contact/page.tsx",
        ns: "contactPublic",
        titleKey: "pageTitle",
        descKey: "intro",
      },
      {
        file: "app/membership/page.tsx",
        ns: "membershipPublic",
        titleKey: "pageTitle",
        descKey: "pageSubtitle",
      },
    ];

    for (const route of routes) {
      const page = readWeb(route.file);
      assert.match(page, /generateMetadata/);
      assert.match(page, /buildPublicPageMetadataForRequest/);
      assert.match(page, new RegExp(`getTranslations\\(["']${route.ns}["']\\)`));
      assert.match(page, new RegExp(`t\\(["']${route.titleKey}["']`));
      assert.match(page, new RegExp(`t\\(["']${route.descKey}["']`));
      assert.doesNotMatch(page, /generateContentTranslation|resolveTranslatedContent|loadBlogMetadataTranslationFields|loadInitiativeMetadataTranslationFields/);
      assert.doesNotMatch(page, /extendedLocalization|seoReadiness|Extended Localization/i);
      assert.doesNotMatch(page, /\bka\b|\bhe\b|xx-SEOFUT/);
    }

    const privacy = readWeb("app/privacy/page.tsx");
    assert.match(privacy, /buildPublicPageMetadataForRequest/);
    assert.match(privacy, /getTranslations\(["']legalPublic["']\)/);
    assert.match(privacy, /t\(["']privacy\.title["']\)/);
    assert.match(privacy, /brand\.defaultMetaDescription/);
    assert.doesNotMatch(privacy, /generateContentTranslation/);
    const privacyMeta = privacy.slice(
      privacy.indexOf("export async function generateMetadata"),
      privacy.indexOf("/** English canonical Privacy"),
    );
    assert.doesNotMatch(privacyMeta, /counselNote|localizedBodyHtml|EnglishPrivacyBody/);

    const terms = readWeb("app/terms/page.tsx");
    assert.match(terms, /buildPublicPageMetadataForRequest/);
    assert.match(terms, /getTranslations\(["']legalPublic["']\)/);
    assert.match(terms, /t\(["']terms\.title["']\)/);
    assert.match(terms, /brand\.defaultMetaDescription/);
    const termsMeta = terms.slice(
      terms.indexOf("export async function generateMetadata"),
      terms.indexOf("/** English canonical Terms"),
    );
    assert.doesNotMatch(termsMeta, /counselNote|localizedBodyHtml|EnglishTermsBody/);

    // 15–16. Home + Media remain the prior 07C.3 ownership (Brand / WEB_UI meta).
    const home = readWeb("app/page.tsx");
    assert.match(home, /brand\.seoSiteName/);
    assert.match(home, /brand\.defaultMetaDescription/);
    assert.doesNotMatch(home, /blogPublic|worldInitiativesPublic|legalPublic/);

    const media = readWeb("app/media/page.tsx");
    assert.match(media, /getTranslations\(["']civicMediaPublic["']\)/);
    assert.match(media, /t\(["']metaTitle["']/);
    assert.match(media, /t\(["']metaDescription["']/);
    assert.doesNotMatch(media, /07F\.2/);

    const localeTwins = [
      "app/[locale]/blog/page.tsx",
      "app/[locale]/initiatives/page.tsx",
      "app/[locale]/institutions/page.tsx",
      "app/[locale]/knowledge/page.tsx",
      "app/[locale]/volunteer/page.tsx",
      "app/[locale]/contact/page.tsx",
      "app/[locale]/membership/page.tsx",
      "app/[locale]/privacy/page.tsx",
      "app/[locale]/terms/page.tsx",
    ];
    for (const twin of localeTwins) {
      assert.match(
        readWeb(twin),
        /export \{ default, generateMetadata \} from ["']\.\.\/\.\.\/[^"']+["']/,
      );
      assert.doesNotMatch(readWeb(twin), /buildPublicPageMetadataForRequest/);
    }

    assert.doesNotMatch(readWeb("app/blog/page.tsx"), /export const metadata/);
  });

  it("1–9. WEB_UI / Brand sources emit title+description through ForRequest", async () => {
    const { messages } = await loadUiMessagesForLocale("uk");
    const root = messages as Nested;
    const siteName = "Humanity Union";

    const cases: Array<{
      path: string;
      title: string;
      description: string;
    }> = [
      {
        path: "/blog",
        title: str(nest(root, "blogPublic"), "pageTitle"),
        description: interpolateSiteName(
          str(nest(root, "blogPublic"), "pageSubtitle"),
          siteName,
        ),
      },
      {
        path: "/initiatives",
        title: str(nest(root, "worldInitiativesPublic"), "pageTitle"),
        description: str(nest(root, "worldInitiativesPublic"), "pageIntro"),
      },
      {
        path: "/institutions",
        title: str(nest(root, "institutionsPublic"), "headline"),
        description: str(nest(root, "institutionsPublic"), "subheadline"),
      },
      {
        path: "/knowledge",
        title: str(nest(root, "knowledgePublic"), "pageTitle"),
        description: interpolateSiteName(
          str(nest(root, "knowledgePublic"), "pageIntro"),
          siteName,
        ),
      },
      {
        path: "/volunteer",
        title: str(nest(root, "volunteerPublic"), "title"),
        description: str(nest(root, "volunteerPublic"), "lead"),
      },
      {
        path: "/contact",
        title: str(nest(root, "contactPublic"), "pageTitle"),
        description: interpolateSiteName(str(nest(root, "contactPublic"), "intro"), siteName),
      },
      {
        path: "/membership",
        title: str(nest(root, "membershipPublic"), "pageTitle"),
        description: interpolateSiteName(
          str(nest(root, "membershipPublic"), "pageSubtitle"),
          siteName,
        ),
      },
      {
        path: "/privacy",
        title: str(nest(nest(root, "legalPublic"), "privacy"), "title"),
        description: "World Solidarity civic technology platform",
      },
      {
        path: "/terms",
        title: str(nest(nest(root, "legalPublic"), "terms"), "title"),
        description: "World Solidarity civic technology platform",
      },
    ];

    for (const row of cases) {
      assert.match(row.title, /\S/);
      const meta = await buildPublicPageMetadataForRequest({
        title: row.title,
        description: row.description,
        canonicalPath: row.path,
        localeFreeCanonicalPath: row.path,
        catalog: CATALOG,
        pathname: row.path,
        urlLocaleSegment: null,
      });
      assert.match(String(meta.title), new RegExp(row.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal(meta.description, normalizeMetaDescription(row.description));
      assert.equal(meta.alternates?.canonical, row.path);
    }

    assert.equal(str(nest(root, "blogPublic"), "pageTitle"), "Блог");

    // Blog English catalog still yields "Blog" chrome title (WEB_UI authority).
    const en = await loadUiMessagesForLocale("en");
    const enBlog = nest(en.messages as Nested, "blogPublic");
    assert.equal(str(enBlog, "pageTitle"), "Blog");
  });

  it("10–13. locale-prefixed self-canonical; Registry hreflang; locale-free English; synthetic future", async () => {
    const path = "/initiatives";
    const localeFree = await buildPublicPageMetadataForRequest({
      title: "World Initiatives",
      description: "Explore",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: path,
      urlLocaleSegment: null,
    });
    assert.equal(localeFree.alternates?.canonical, path);
    const languages = (localeFree.alternates as { languages?: Record<string, string> })
      .languages;
    assert.equal(languages?.en, path);
    assert.equal(languages?.uk, `/uk${path}`);
    assert.equal(languages?.["xx-SEOFUT"], `/xx-seofut${path}`);
    assert.equal(languages?.["x-default"], path);
    assert.equal(languages?.ar, undefined);
    assert.doesNotMatch(JSON.stringify(languages), /\/en(\/|"|$)/);

    const prefixed = await buildPublicPageMetadataForRequest({
      title: "Світові ініціативи",
      description: "Опис",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: `/uk${path}`,
      urlLocaleSegment: "uk",
    });
    assert.equal(prefixed.alternates?.canonical, `/uk${path}`);
    assert.equal(prefixed.openGraph?.url, `/uk${path}`);

    const future = await buildPublicPageMetadataForRequest({
      title: "Volunteer",
      description: "Lead",
      canonicalPath: "/volunteer",
      localeFreeCanonicalPath: "/volunteer",
      catalog: CATALOG,
      pathname: "/xx-seofut/volunteer",
      urlLocaleSegment: "xx-seofut",
    });
    assert.equal(future.alternates?.canonical, "/xx-seofut/volunteer");
    assert.equal(
      (future.alternates as { languages?: Record<string, string> }).languages?.[
        "xx-SEOFUT"
      ],
      "/xx-seofut/volunteer",
    );
  });

  it("14. missing localized WEB_UI overlay falls back to English catalog merge", async () => {
    const { messages } = await loadUiMessagesForLocale("xx-SEOFUT");
    const blog = nest(messages as Nested, "blogPublic");
    assert.equal(str(blog, "pageTitle"), "Blog");
    assert.match(str(blog, "pageSubtitle"), /Ideas, reflections/);
  });

  it("17–18. no CT / Extended Localization readiness on static index pages", () => {
    for (const file of [
      "app/blog/page.tsx",
      "app/initiatives/page.tsx",
      "app/institutions/page.tsx",
      "app/knowledge/page.tsx",
      "app/volunteer/page.tsx",
      "app/contact/page.tsx",
      "app/membership/page.tsx",
      "app/privacy/page.tsx",
      "app/terms/page.tsx",
    ]) {
      const src = readWeb(file);
      assert.doesNotMatch(
        src,
        /content.?translation|ContentTranslation|resolveTranslatedContent|preferTranslation/i,
      );
      assert.doesNotMatch(src, /isExtendedLocalizationReady|seoReadiness|readinessGate/i);
    }
  });
});

describe("Support public metadata contract", () => {
  it("uses supportPublic title/subtitle through the shared builder without a locale route", () => {
    const page = readWeb("app/support/page.tsx");
    assert.match(page, /generateMetadata/);
    assert.match(page, /buildPublicPageMetadataForRequest/);
    assert.match(page, /getTranslations\(["']supportPublic["']\)/);
    assert.match(page, /t\(["']title["']/);
    assert.match(page, /t\(["']subtitle["']\)/);
    assert.match(page, /titleBrandSuffix:\s*""/);
    assert.match(page, /canonicalPath:\s*"\/support"/);
    assert.match(page, /localeFreeCanonicalPath:\s*"\/support"/);
    assert.doesNotMatch(page, /indexable:\s*false/);
    assert.doesNotMatch(page, /https?:\/\/(staging\.)?huws\.org/);
    assert.doesNotMatch(page, /PUBLIC_SEO_LOCALE_PATH_PATTERNS|hreflang/);
    assert.equal(existsSync(path.join(webSrc, "app/[locale]/support/page.tsx")), false);
    assert.equal(isPublicSeoLocalePath("/support"), false);
    assert.ok(STATIC_PUBLIC_SITEMAP_PATHS.includes("/support"));
    assert.ok(!STATIC_PUBLIC_SITEMAP_PATHS.some((entry) => entry !== "/support" && entry.endsWith("/support")));
  });

  it("emits an unsuffixed title, subtitle description, canonical, and indexability gate", async () => {
    const { messages } = await loadUiMessagesForLocale("en");
    const support = nest(messages as Nested, "supportPublic");
    const siteName = "Humanity Union";
    const title = interpolateSiteName(str(support, "title"), siteName);
    const description = str(support, "subtitle");
    assert.equal(title, "Support Humanity Union");
    assert.equal(description, "Help build better conditions for thoughtful collective action.");

    const prevMode = process.env.NEXT_PUBLIC_PLATFORM_MODE;
    const prevPlatform = process.env.PLATFORM_MODE;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const input = {
      title,
      description,
      canonicalPath: "/support",
      localeFreeCanonicalPath: "/support",
      catalog: CATALOG,
      pathname: "/support",
      urlLocaleSegment: null,
      openGraphSiteName: siteName,
      titleBrandSuffix: "",
    };

    process.env.NEXT_PUBLIC_PLATFORM_MODE = "production";
    delete process.env.PLATFORM_MODE;
    process.env.NEXT_PUBLIC_SITE_URL = "https://huws.org";
    try {
      assert.equal(shouldDisallowSearchIndexing(), false);
      const meta = await buildPublicPageMetadataForRequest(input);
      assert.equal(meta.title, "Support Humanity Union");
      assert.equal(meta.description, normalizeMetaDescription(description));
      assert.equal(meta.alternates?.canonical, "https://huws.org/support");
      assert.equal(meta.alternates?.languages, undefined);
      assert.equal(meta.openGraph?.title, "Support Humanity Union");
      assert.equal(meta.openGraph?.description, description);
      assert.equal(meta.openGraph?.url, "https://huws.org/support");
      assert.equal(meta.openGraph?.siteName, siteName);
      assert.equal(meta.openGraph?.images, undefined);
      const twitter = meta.twitter as { card?: string; title?: string; description?: string; images?: unknown };
      assert.equal(twitter.card, "summary");
      assert.equal(twitter.title, "Support Humanity Union");
      assert.equal(twitter.description, description);
      assert.equal(twitter.images, undefined);
      assert.equal((meta.robots as { index?: boolean }).index, true);

      process.env.NEXT_PUBLIC_PLATFORM_MODE = "staging";
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.huws.org";
      assert.equal(shouldDisallowSearchIndexing(), true);
      const staging = await buildPublicPageMetadataForRequest(input);
      assert.equal(staging.alternates?.canonical, "https://staging.huws.org/support");
      assert.equal(staging.alternates?.languages, undefined);
      assert.deepEqual(staging.robots, { index: false, follow: false, nocache: true });
    } finally {
      if (prevMode === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_MODE;
      else process.env.NEXT_PUBLIC_PLATFORM_MODE = prevMode;
      if (prevPlatform === undefined) delete process.env.PLATFORM_MODE;
      else process.env.PLATFORM_MODE = prevPlatform;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });
});
