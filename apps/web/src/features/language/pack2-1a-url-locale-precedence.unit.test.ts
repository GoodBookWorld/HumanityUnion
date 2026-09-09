/**
 * Pack 2.1A — URL locale precedence end-to-end (request signals → document locale).
 * No Mongo / no provider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PublicSeoLocaleRoutingCatalogEntry } from "@hu/types";
import { parsePublicSeoLocalePrefixedPath } from "@hu/types";

import { resolveDocumentHtmlLocale } from "./resolve-document-locale.js";
import {
  resolveUrlLocaleSegmentFromRequestSignals,
  shouldSuppressInterfaceLanguageCookieSyncForPath,
} from "./public-seo-locale-request.js";

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
];

describe("Pack 2.1A — URL locale precedence end-to-end", () => {
  it("A. /uk/initiatives/public/... with cookie=ar => effective uk", async () => {
    const pathname = "/uk/initiatives/public/initiative-1784349613932";
    const segment = resolveUrlLocaleSegmentFromRequestSignals({ pathname });
    assert.equal(segment, "uk");
    assert.equal(parsePublicSeoLocalePrefixedPath(pathname)?.segment, "uk");

    const resolved = await resolveDocumentHtmlLocale({
      pathname,
      catalog: CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en-US,en;q=0.9",
      participantInterfaceLanguage: "en",
      authenticated: true,
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "url");
  });

  it("B. /zh-hant/media with cookie=uk => effective zh-Hant", async () => {
    const pathname = "/zh-hant/media";
    const resolved = await resolveDocumentHtmlLocale({
      pathname,
      catalog: CATALOG,
      huLangCookie: "uk",
    });
    assert.equal(resolved.locale, "zh-Hant");
    assert.equal(resolved.source, "url");
  });

  it("C. /ar/blog with Accept-Language=en => effective ar", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      pathname: "/ar/blog",
      catalog: CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.source, "url");
    assert.equal(resolved.textDirection, "rtl");
  });

  it("D. locale-free /initiatives with cookie=uk preserves cookie behavior", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      pathname: "/initiatives",
      catalog: CATALOG,
      huLangCookie: "uk",
      acceptLanguageHeader: "ar",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "cookie");
  });

  it("E. unsupported / non-SEO-prefixed path is not authoritative", async () => {
    assert.equal(
      resolveUrlLocaleSegmentFromRequestSignals({ pathname: "/uk/admin" }),
      null,
    );
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/workspace"), null);

    const resolved = await resolveDocumentHtmlLocale({
      pathname: "/uk/admin",
      catalog: CATALOG,
      huLangCookie: "uk",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "cookie");
  });

  it("F. root document locale and next-intl request config share resolveDocumentHtmlLocale", () => {
    const layout = readWeb("app/layout.tsx");
    const request = readWeb("i18n/request.ts");
    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.match(layout, /locale=\{documentLocale\.locale\}/);
    assert.match(request, /resolveDocumentHtmlLocale/);
    assert.match(request, /locale: documentLocale\.locale/);
    assert.doesNotMatch(request, /huLangCookie|Accept-Language|parsePublicSeoLocalePrefixedPath/);
  });

  it("G. no provider generation path is introduced", () => {
    const documentLocale = readWeb("features/language/resolve-document-locale.ts");
    const requestSignals = readWeb("features/language/public-seo-locale-request.ts");
    const middleware = readFileSync(path.join(webRoot, "middleware.ts"), "utf8");

    assert.doesNotMatch(documentLocale, /from ["'][^"']*translation-provider/i);
    assert.doesNotMatch(documentLocale, /generateContent|gemini\.generate/i);
    assert.doesNotMatch(requestSignals, /generateContent|gemini\.generate/i);
    assert.match(middleware, /HU_PATHNAME_HEADER/);
    assert.match(middleware, /HU_URL_LOCALE_SEGMENT_HEADER/);
    assert.match(documentLocale, /resolveUrlLocaleSegmentFromRequestSignals/);
    assert.match(documentLocale, /HU_PATHNAME_HEADER/);
  });

  it("H. InterfaceLanguageCookieSync cannot override a valid locale-prefixed document", () => {
    assert.equal(
      shouldSuppressInterfaceLanguageCookieSyncForPath(
        "/uk/initiatives/public/initiative-1784349613932",
      ),
      true,
    );
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/zh-hant/media"), true);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/ar/blog"), true);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/initiatives"), false);
    assert.equal(shouldSuppressInterfaceLanguageCookieSyncForPath("/uk/admin"), false);

    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");
    assert.match(sync, /shouldSuppressInterfaceLanguageCookieSyncForPath/);
    assert.match(sync, /usePathname/);
  });

  it("pathname signal wins over a conflicting segment header", () => {
    const segment = resolveUrlLocaleSegmentFromRequestSignals({
      pathname: "/uk/media",
      urlLocaleSegmentHeader: "ar",
    });
    assert.equal(segment, "uk");
  });

  it("segment header alone still recovers when pathname is absent", () => {
    const segment = resolveUrlLocaleSegmentFromRequestSignals({
      pathname: null,
      urlLocaleSegmentHeader: "zh-hant",
    });
    assert.equal(segment, "zh-hant");
  });
});
