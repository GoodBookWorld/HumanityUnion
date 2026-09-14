/**
 * Step 07C.3 — migrated public metadata surfaces use request-aware
 * canonical/hreflang while preserving title/description authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

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

describe("Step 07C.3 — apply multilingual canonical/hreflang to public metadata", () => {
  it("architecture: migrated surfaces use ForRequest; [locale] re-exports remain", () => {
    assert.match(readWeb("app/page.tsx"), /buildPublicPageMetadataForRequest/);
    assert.match(
      readWeb("app/initiatives/public/[initiativeId]/page.tsx"),
      /buildPublicPageMetadataForRequest/,
    );
    assert.match(readWeb("app/blog/[slug]/page.tsx"), /buildPublicPageMetadataForRequest/);
    assert.match(readWeb("app/knowledge/[slug]/page.tsx"), /buildPublicPageMetadataForRequest/);
    assert.match(readWeb("app/media/page.tsx"), /buildPublicPageMetadataForRequest/);

    assert.match(
      readWeb("app/[locale]/page.tsx"),
      /export \{ default, generateMetadata \} from ["']\.\.\/page["']/,
    );
    assert.match(
      readWeb("app/[locale]/initiatives/public/[initiativeId]/page.tsx"),
      /canonicalGenerateMetadata/,
    );
    assert.match(
      readWeb("app/[locale]/blog/[slug]/page.tsx"),
      /canonicalGenerateMetadata/,
    );
    assert.match(
      readWeb("app/[locale]/media/page.tsx"),
      /generateMetadata \} from ["']\.\.\/\.\.\/media\/page["']/,
    );
  });

  it("1–3. Home locale-free / SEO-prefixed canonical + hreflang; Brand authority preserved", async () => {
    const home = readWeb("app/page.tsx");
    assert.match(home, /resolveBrandForMetadata/);
    assert.match(home, /brand\.seoSiteName/);
    assert.match(home, /brand\.defaultMetaDescription/);
    assert.doesNotMatch(home, /getTranslations\(["']seo\.home["']\)/);

    const localeFree = await buildPublicPageMetadataForRequest({
      title: "Humanity Union",
      description: "Brand description",
      canonicalPath: "/",
      localeFreeCanonicalPath: "/",
      titleBrandSuffix: "",
      catalog: CATALOG,
      pathname: "/",
      urlLocaleSegment: null,
    });
    assert.equal(localeFree.alternates?.canonical, "/");
    assert.equal(localeFree.title, "Humanity Union");
    assert.equal(localeFree.description, "Brand description");
    const languages = (localeFree.alternates as { languages?: Record<string, string> })
      .languages;
    assert.equal(languages?.en, "/");
    assert.equal(languages?.uk, "/uk");
    assert.equal(languages?.["xx-SEOFUT"], "/xx-seofut");
    assert.equal(languages?.["x-default"], "/");
    assert.equal(languages?.ar, undefined);
    assert.doesNotMatch(JSON.stringify(languages), /\/en(\/|"|$)/);

    const prefixed = await buildPublicPageMetadataForRequest({
      title: "Humanity Union",
      description: "Brand description",
      canonicalPath: "/",
      localeFreeCanonicalPath: "/",
      titleBrandSuffix: "",
      catalog: CATALOG,
      pathname: "/uk",
      urlLocaleSegment: "uk",
    });
    assert.equal(prefixed.alternates?.canonical, "/uk");
    assert.equal(prefixed.openGraph?.url, "/uk");
    assert.equal(prefixed.title, "Humanity Union");
  });

  it("4–6. Initiative canonical/hreflang; CT + Admin override wiring preserved", async () => {
    const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(page, /loadInitiativeMetadataTranslationFields/);
    assert.match(page, /resolveLocalizedPublicMetadataCopy/);
    assert.match(page, /fetchPublicSeoPageOverride/);
    assert.match(page, /applyPageSeoOverrideToMetadataInput/);
    assert.doesNotMatch(page, /generateContentTranslation/);

    const path = "/initiatives/public/init-07c3";
    const localeFree = await buildPublicPageMetadataForRequest({
      title: "Канонічна",
      description: "Опис",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: path,
      urlLocaleSegment: null,
    });
    assert.equal(localeFree.alternates?.canonical, path);
    assert.equal(localeFree.title, "Канонічна | Humanity Union");
    assert.equal(
      (localeFree.alternates as { languages?: Record<string, string> }).languages?.uk,
      `/uk${path}`,
    );

    const prefixed = await buildPublicPageMetadataForRequest({
      title: "Канонічна",
      description: "Опис",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: `/uk${path}`,
      urlLocaleSegment: "uk",
    });
    assert.equal(prefixed.alternates?.canonical, `/uk${path}`);
    assert.equal(prefixed.openGraph?.url, `/uk${path}`);
  });

  it("7. Blog detail canonical/hreflang; Step 07D adds compact CT overlay", async () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    assert.match(page, /buildPublicPageMetadataForRequest/);
    assert.match(page, /loadBlogMetadataTranslationFields/);
    assert.match(page, /seo\?\.title|post\.title/);
    assert.doesNotMatch(page, /generateContentTranslation/);

    const path = "/blog/hello-07c3";
    const meta = await buildPublicPageMetadataForRequest({
      title: "Hello",
      description: "Excerpt",
      titleBrandSuffix: "Blog | Humanity Union",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: `/xx-seofut${path}`,
      urlLocaleSegment: "xx-seofut",
    });
    assert.equal(meta.alternates?.canonical, `/xx-seofut${path}`);
    assert.match(String(meta.title), /Hello/);
    assert.equal(meta.description, "Excerpt");
  });

  it("8. Knowledge detail canonical/hreflang", async () => {
    const page = readWeb("app/knowledge/[slug]/page.tsx");
    assert.match(page, /buildPublicPageMetadataForRequest/);
    assert.match(page, /article\.title/);

    const path = "/knowledge/guide-07c3";
    const meta = await buildPublicPageMetadataForRequest({
      title: "Guide",
      description: "Purpose",
      canonicalPath: path,
      localeFreeCanonicalPath: path,
      catalog: CATALOG,
      pathname: `/uk${path}`,
      urlLocaleSegment: "uk",
    });
    assert.equal(meta.alternates?.canonical, `/uk${path}`);
  });

  it("9. Media keeps WEB_UI meta source; shared builder for canonical/hreflang", async () => {
    const page = readWeb("app/media/page.tsx");
    assert.match(page, /getTranslations\(["']civicMediaPublic["']\)/);
    assert.match(page, /t\(["']metaTitle["']/);
    assert.match(page, /t\(["']metaDescription["']/);
    assert.match(page, /buildPublicPageMetadataForRequest/);
    assert.doesNotMatch(page, /alternates:\s*\{\s*canonical:\s*["']\/media["']/);

    const meta = await buildPublicPageMetadataForRequest({
      title: "Media WEB_UI Title",
      description: "Media WEB_UI Description",
      canonicalPath: "/media",
      localeFreeCanonicalPath: "/media",
      titleBrandSuffix: "",
      catalog: CATALOG,
      pathname: "/uk/media",
      urlLocaleSegment: "uk",
    });
    assert.equal(meta.title, "Media WEB_UI Title");
    assert.equal(meta.description, "Media WEB_UI Description");
    assert.equal(meta.alternates?.canonical, "/uk/media");
  });

  it("10–11. no /en/...; locale-free metadata remains valid", async () => {
    const meta = await buildPublicPageMetadataForRequest({
      title: "Home",
      canonicalPath: "/",
      localeFreeCanonicalPath: "/",
      titleBrandSuffix: "",
      catalog: CATALOG,
      pathname: "/",
      urlLocaleSegment: null,
    });
    assert.doesNotMatch(JSON.stringify(meta.alternates), /\/en(\/|"|$)/);
    assert.equal(meta.alternates?.canonical, "/");
  });

  it("12. Registry failure / empty catalog does not break metadata generation", async () => {
    const meta = await buildPublicPageMetadataForRequest({
      title: "Safe",
      description: "Still renders",
      canonicalPath: "/media",
      localeFreeCanonicalPath: "/media",
      titleBrandSuffix: "",
      catalog: [],
      pathname: "/media",
      urlLocaleSegment: null,
    });
    assert.equal(meta.title, "Safe");
    assert.equal(meta.description, "Still renders");
    assert.equal(meta.alternates?.canonical, "/media");
    assert.equal(
      (meta.alternates as { languages?: unknown }).languages,
      undefined,
    );
  });
});
