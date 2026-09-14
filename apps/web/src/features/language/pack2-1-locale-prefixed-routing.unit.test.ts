/**
 * Pack 2.1 — locale-prefixed public SEO routing foundation (no provider / no Mongo).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  parsePublicSeoLocalePrefixedPath,
  resolvePublicSeoLocaleDocument,
  toPublicSeoLocaleUrlSegment,
  type PublicSeoLocaleRoutingCatalogEntry,
} from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.join(webRoot, "src");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const CATALOG: readonly PublicSeoLocaleRoutingCatalogEntry[] = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-uk",
    locale: "uk",
    textDirection: "ltr",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-ar",
    locale: "ar",
    textDirection: "rtl",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-fr",
    locale: "fr",
    textDirection: "ltr",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: false,
  },
  {
    languageId: "lang-de",
    locale: "de",
    textDirection: "ltr",
    aliases: [],
    enabled: false,
    seoIndexingEnabled: true,
  },
];

describe("Pack 2.1 — locale-prefixed public routing foundation", () => {
  it("/uk/initiatives resolves locale uk", () => {
    const parsed = parsePublicSeoLocalePrefixedPath("/uk/initiatives");
    assert.deepEqual(parsed, { segment: "uk", localeFreePath: "/initiatives" });
    const doc = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: parsed?.segment,
      catalog: CATALOG,
      runtime: { huLangCookie: "ar" },
    });
    assert.equal(doc.normalizedLocale, "uk");
    assert.equal(doc.seoIndexable, true);
    assert.equal(doc.isLocalePrefixedDocument, true);
    assert.equal(doc.effectiveLocale.locale, "uk");
    assert.equal(doc.effectiveLocale.source, "url");
  });

  it("/ar/blog resolves locale ar", () => {
    const parsed = parsePublicSeoLocalePrefixedPath("/ar/blog");
    assert.equal(parsed?.segment, "ar");
    const doc = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: "ar",
      catalog: CATALOG,
    });
    assert.equal(doc.effectiveLocale.locale, "ar");
    assert.equal(doc.effectiveLocale.textDirection, "rtl");
    assert.equal(doc.isLocalePrefixedDocument, true);
  });

  it("/zh-hant/media resolves normalized locale zh-Hant", () => {
    assert.equal(toPublicSeoLocaleUrlSegment("zh-Hant"), "zh-hant");
    const parsed = parsePublicSeoLocalePrefixedPath("/zh-hant/media");
    assert.equal(parsed?.segment, "zh-hant");
    const doc = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: "zh-hant",
      catalog: CATALOG,
      runtime: { huLangCookie: "uk" },
    });
    assert.equal(doc.normalizedLocale, "zh-Hant");
    assert.equal(doc.effectiveLocale.locale, "zh-Hant");
    assert.equal(doc.effectiveLocale.source, "url");
  });

  it("locale-prefixed URL wins over a different language cookie", () => {
    const doc = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: "uk",
      catalog: CATALOG,
      runtime: {
        huLangCookie: "ar",
        acceptLanguageHeader: "de-DE,de;q=0.9",
      },
    });
    assert.equal(doc.effectiveLocale.locale, "uk");
    assert.equal(doc.effectiveLocale.source, "url");
    assert.notEqual(doc.effectiveLocale.locale, "ar");
  });

  it("locale-free route keeps existing cookie / Accept-Language behavior", () => {
    const doc = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: null,
      catalog: CATALOG,
      runtime: { huLangCookie: "ar" },
    });
    assert.equal(doc.isLocalePrefixedDocument, false);
    assert.equal(doc.urlLocaleSegment, null);
    assert.equal(doc.effectiveLocale.locale, "ar");
    assert.equal(doc.effectiveLocale.source, "cookie");
  });

  it("disabled / non-SEO locale is not an indexable localized document", () => {
    const nonSeo = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: "fr",
      catalog: CATALOG,
      runtime: { huLangCookie: "uk" },
    });
    assert.equal(nonSeo.normalizedLocale, "fr");
    assert.equal(nonSeo.enabled, true);
    assert.equal(nonSeo.seoIndexable, false);
    assert.equal(nonSeo.isLocalePrefixedDocument, false);
    assert.equal(nonSeo.effectiveLocale.locale, "uk");
    assert.equal(nonSeo.effectiveLocale.source, "cookie");

    const disabled = resolvePublicSeoLocaleDocument({
      urlLocaleSegment: "de",
      catalog: CATALOG,
      runtime: { huLangCookie: "uk" },
    });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.seoIndexable, false);
    assert.equal(disabled.isLocalePrefixedDocument, false);
    assert.equal(disabled.effectiveLocale.locale, "uk");
  });

  it("non-SEO private/workspace/admin routes are not locale-prefix candidates", () => {
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/admin"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/workspace"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/ar/login"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/zh-hant/search"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/civic-activity"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/account"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/support"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/admin"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/workspace/messages"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/blog/subscribe"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/knowledge/media"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/membership/success"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/initiatives/create"), null);
  });

  it("no provider generation is introduced on route resolution", () => {
    const typesResolver = readFileSync(
      path.resolve(here, "../../../../../packages/types/src/domain/public-seo-locale-routing.ts"),
      "utf8",
    );
    assert.doesNotMatch(typesResolver, /from ["'][^"']*translation-provider/i);
    assert.doesNotMatch(typesResolver, /generateContent|@google\/generative|gemini\.generate/i);

    const documentLocale = readWeb("features/language/resolve-document-locale.ts");
    assert.doesNotMatch(documentLocale, /from ["'][^"']*translation-provider/i);
    assert.doesNotMatch(documentLocale, /generateContent|gemini\.generate/i);
    assert.match(documentLocale, /resolvePublicSeoLocaleDocument/);

    const middleware = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    assert.doesNotMatch(middleware, /from ["']next-intl\/middleware["']/);
    assert.doesNotMatch(middleware, /\bcreateMiddleware\s*\(/);
    assert.doesNotMatch(middleware, /\bdefineRouting\s*\(/);
    assert.match(middleware, /parsePublicSeoLocalePrefixedPath/);
    assert.match(middleware, /HU_URL_LOCALE_SEGMENT_HEADER/);
    assert.match(middleware, /HU_PATHNAME_HEADER/);
    assert.match(middleware, /export async function proxy/);
    assert.equal(existsSync(path.join(webRoot, "proxy.ts")), false);
  });

  it("thin [locale] tree exists only for SEO public perimeter and validates in layout", () => {
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "layout.tsx")), true);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "initiatives", "page.tsx")), true);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "blog", "page.tsx")), true);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "media", "page.tsx")), true);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "admin")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "workspace")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "login")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]", "search")), false);

    const layout = readWeb("app/[locale]/layout.tsx");
    assert.match(layout, /notFound/);
    assert.match(layout, /isLocalePrefixedDocument/);
    assert.doesNotMatch(layout, /TranslationProvider/);
  });
});
