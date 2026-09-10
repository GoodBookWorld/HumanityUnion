/**
 * Pack 2.1B — proxy request-scoped hu_lang authority (no provider / no Mongo).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { HU_LANG_COOKIE_NAME } from "@hu/types";

import {
  decideSeoProxyCookieAuthority,
  normalizeSeoLocaleUrlSegmentToPlatformLocale,
  rewriteRequestCookieHeaderHuLang,
  type SeoProxyRegistryLocaleRow,
} from "./public-seo-locale-request.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.join(webRoot, "src");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const BASE_CATALOG: readonly SeoProxyRegistryLocaleRow[] = [
  {
    locale: "en",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    locale: "uk",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    locale: "ar",
    aliases: [],
    enabled: true,
    seoIndexingEnabled: true,
  },
  {
    locale: "zh-Hant",
    aliases: ["zh-TW", "zh-HK"],
    enabled: true,
    seoIndexingEnabled: true,
  },
];

describe("Pack 2.1B — proxy URL locale cookie authority", () => {
  it("A. /uk/... preserves session cookie and overrides hu_lang=ar → uk", () => {
    const incoming = "hu_lang=ar; session=abc";
    const forwarded = rewriteRequestCookieHeaderHuLang(incoming, "uk");
    assert.match(forwarded, /(?:^|;\s*)session=abc(?:;|$)/);
    assert.match(forwarded, new RegExp(`${HU_LANG_COOKIE_NAME}=uk`));
    assert.doesNotMatch(forwarded, /hu_lang=ar/);
    assert.equal(forwarded.includes("session=abc"), true);
  });

  it("B. /zh-hant/media normalizes cookie to zh-Hant", () => {
    const platform = normalizeSeoLocaleUrlSegmentToPlatformLocale("zh-hant");
    assert.equal(platform, "zh-Hant");
    const forwarded = rewriteRequestCookieHeaderHuLang("hu_lang=en", platform);
    assert.equal(forwarded, "hu_lang=zh-Hant");
  });

  it("C. /ar/blog with no hu_lang appends hu_lang=ar", () => {
    const forwarded = rewriteRequestCookieHeaderHuLang(null, "ar");
    assert.equal(forwarded, "hu_lang=ar");
    const withOther = rewriteRequestCookieHeaderHuLang("session=xyz", "ar");
    assert.match(withOther, /session=xyz/);
    assert.match(withOther, /hu_lang=ar/);
  });

  it("1. enabled=false + seoIndexingEnabled=true => no override", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "de",
      catalog: [
        ...BASE_CATALOG,
        {
          locale: "de",
          aliases: [],
          enabled: false,
          seoIndexingEnabled: true,
        },
      ],
    });
    assert.deepEqual(decision, {
      applyOverride: false,
      reason: "not_seo_indexable",
    });
  });

  it("2. enabled=true + seoIndexingEnabled=false => no override", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "fr",
      catalog: [
        ...BASE_CATALOG,
        {
          locale: "fr",
          aliases: [],
          enabled: true,
          seoIndexingEnabled: false,
        },
      ],
    });
    assert.deepEqual(decision, {
      applyOverride: false,
      reason: "not_seo_indexable",
    });
  });

  it("3. Registry fetch failure => no override", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "uk",
      catalog: null,
    });
    assert.deepEqual(decision, {
      applyOverride: false,
      reason: "registry_unavailable",
    });
  });

  it("4. locale absent from Registry => no override", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "pl",
      catalog: BASE_CATALOG,
    });
    assert.deepEqual(decision, {
      applyOverride: false,
      reason: "locale_absent",
    });
  });

  it("5. enabled=true + seoIndexingEnabled=true => override still works", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "uk",
      catalog: BASE_CATALOG,
    });
    assert.deepEqual(decision, { applyOverride: true, locale: "uk" });

    const zh = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "zh-hant",
      catalog: BASE_CATALOG,
    });
    assert.deepEqual(zh, { applyOverride: true, locale: "zh-Hant" });
  });

  it("6. other cookies remain preserved under override", () => {
    const decision = decideSeoProxyCookieAuthority({
      urlLocaleSegment: "uk",
      catalog: BASE_CATALOG,
    });
    assert.equal(decision.applyOverride, true);
    if (!decision.applyOverride) {
      return;
    }
    const forwarded = rewriteRequestCookieHeaderHuLang(
      "hu_lang=ar; session=abc; theme=dark",
      decision.locale,
    );
    assert.match(forwarded, /session=abc/);
    assert.match(forwarded, /theme=dark/);
    assert.match(forwarded, /hu_lang=uk/);
    assert.doesNotMatch(forwarded, /hu_lang=ar/);
  });

  it("D. locale-free /initiatives is not an SEO locale-prefix candidate", async () => {
    const { parsePublicSeoLocalePrefixedPath } = await import("@hu/types");
    assert.equal(parsePublicSeoLocalePrefixedPath("/initiatives"), null);
  });

  it("E. invalid / non-SEO prefix is not a cookie-authority candidate", async () => {
    const { parsePublicSeoLocalePrefixedPath } = await import("@hu/types");
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/admin"), null);
    assert.equal(parsePublicSeoLocalePrefixedPath("/uk/workspace"), null);
  });

  it("proxy fail-closed: no cookie override when Registry unavailable", () => {
    const proxy = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    const helpers = readWeb("features/language/public-seo-locale-request.ts");
    assert.match(proxy, /decideSeoProxyCookieAuthority/);
    assert.match(proxy, /decision\.applyOverride/);
    assert.doesNotMatch(proxy, /registryHit === null/);
    assert.doesNotMatch(proxy, /isSeoIndexableLanguage\(\{\s*enabled:\s*true/);
    assert.match(helpers, /enabled: matched\.enabled === true/);
    assert.match(helpers, /registry_unavailable/);
  });

  it("F. proxy at src/proxy.ts; obsolete root proxy/middleware absent; matcher preserved", () => {
    // Pack 2.1C — Next 16 discovers proxy next to src/app, not project root.
    assert.equal(existsSync(path.join(webSrc, "proxy.ts")), true);
    assert.equal(existsSync(path.join(webRoot, "proxy.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    const proxy = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    assert.match(proxy, /export async function proxy/);
    assert.match(proxy, /matcher:/);
    assert.match(proxy, /_next\/static/);
    assert.match(proxy, /favicon\.ico/);
    assert.match(proxy, /from ["']\.\/lib\//);
    assert.match(proxy, /from ["']\.\/features\//);
    assert.doesNotMatch(proxy, /from ["']\.\/src\//);
  });

  it("G. root and next-intl still share resolveDocumentHtmlLocale", () => {
    const layout = readWeb("app/layout.tsx");
    const request = readWeb("i18n/request.ts");
    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.match(request, /resolveDocumentHtmlLocale/);
    assert.match(layout, /locale=\{documentLocale\.locale\}/);
    assert.match(request, /locale: documentLocale\.locale/);
  });

  it("H. no provider generation path is introduced", () => {
    const proxy = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    const requestHelpers = readWeb("features/language/public-seo-locale-request.ts");
    assert.doesNotMatch(proxy, /TranslationProvider|generateContent|gemini\.generate/i);
    assert.doesNotMatch(requestHelpers, /generateContent|gemini\.generate/i);
    assert.doesNotMatch(proxy, /headers\.set\(\s*["']Set-Cookie["']/i);
    assert.doesNotMatch(proxy, /\.setCookie\s*\(/);
    assert.match(proxy, /no Set-Cookie/);
  });

  it("I. locale-prefixed Initiative page is force-dynamic", () => {
    const page = readWeb(
      "app/[locale]/initiatives/public/[initiativeId]/page.tsx",
    );
    assert.match(page, /export const dynamic = "force-dynamic"/);
  });

  it("diagnostic header is temporary and response-only", () => {
    const headers = readWeb("features/language/public-seo-locale-headers.ts");
    assert.match(headers, /HU_SEO_LOCALE_DIAGNOSTIC_HEADER/);
    assert.match(headers, /temporary|Temporary|easy to remove/i);
    const proxy = readFileSync(path.join(webSrc, "proxy.ts"), "utf8");
    assert.match(proxy, /response\.headers\.set\(HU_SEO_LOCALE_DIAGNOSTIC_HEADER/);
    assert.doesNotMatch(proxy, /requestHeaders\.set\(HU_SEO_LOCALE_DIAGNOSTIC_HEADER/);
  });
});
