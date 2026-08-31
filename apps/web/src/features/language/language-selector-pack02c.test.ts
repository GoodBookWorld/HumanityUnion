/**
 * Production Completion Pack 02C Task 03 — language selector + hu_lang sync tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RuntimeLocaleCatalogEntry } from "@hu/types";

import { canonicalizeEnabledLocale } from "./canonicalize-locale.js";
import { buildWebHuLangCookieAttributes, HU_LANG_COOKIE_NAME } from "./hu-lang-cookie.web.js";
import { formatLanguageOptionLabel } from "./public-languages-api.js";
import { resolveDocumentHtmlLocale } from "./resolve-document-locale.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

const CATALOG: readonly RuntimeLocaleCatalogEntry[] = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr",
    aliases: [],
  },
  {
    languageId: "lang-uk",
    locale: "uk",
    textDirection: "ltr",
    aliases: [],
  },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
  },
  {
    languageId: "lang-ar",
    locale: "ar",
    textDirection: "rtl",
    aliases: [],
  },
];

describe("Production Completion Pack 02C Task 03 — language selector + hu_lang", () => {
  it("guest write canonicalizes alias zh-TW → zh-Hant", () => {
    const resolved = canonicalizeEnabledLocale("zh-TW", CATALOG);
    assert.ok(resolved);
    assert.equal(resolved.locale, "zh-Hant");
    assert.notEqual(resolved.locale, "zh");
  });

  it("disabled/unknown locale rejected", () => {
    const withoutUk = CATALOG.filter((row) => row.locale !== "uk");
    assert.equal(canonicalizeEnabledLocale("uk", withoutUk), null);
    assert.equal(canonicalizeEnabledLocale("xx-INVALID", CATALOG), null);
    assert.equal(canonicalizeEnabledLocale("", CATALOG), null);
  });

  it("ar produces RTL on next SSR via catalog resolve", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.textDirection, "rtl");
  });

  it("English fallback preserved", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: null,
    });
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.textDirection, "ltr");
  });

  it("cookie attributes match Task 01 contract", () => {
    const attrs = buildWebHuLangCookieAttributes();
    assert.equal(attrs.name, HU_LANG_COOKIE_NAME);
    assert.equal(attrs.path, "/");
    assert.equal(attrs.sameSite, "lax");
    assert.equal(attrs.httpOnly, false);
    assert.equal(typeof attrs.secure, "boolean");
    assert.ok(attrs.maxAge > 0);

    const clearAttrs = buildWebHuLangCookieAttributes({ clear: true });
    assert.equal(clearAttrs.maxAge, 0);
  });

  it("selector loads Registry API; no hardcoded client catalog", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const publicApi = readWeb("features/language/public-languages-api.ts");
    assert.match(selector, /listSelectablePublicLanguages/);
    assert.match(publicApi, /\/api\/v1\/languages/);
    assert.doesNotMatch(selector, /PRIORITY_LANGUAGE/);
    assert.doesNotMatch(selector, /normalizeLanguageCode/);
  });

  it("guest/auth flows write via Web route; no client html lang/dir mutation", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");
    const route = readWeb("app/api/hu-lang/route.ts");
    const prefs = readWeb("features/preferences/components/PreferencesWorkspace.tsx");

    assert.match(selector, /writeHuLangCookieViaWebRoute/);
    assert.match(selector, /updateMyPreferences/);
    assert.match(selector, /router\.refresh/);
    assert.doesNotMatch(selector, /document\.documentElement/);
    assert.doesNotMatch(selector, /normalizeLanguageCode/);

    assert.match(sync, /getMyPreferences/);
    assert.match(sync, /writeHuLangCookieViaWebRoute/);
    assert.match(sync, /router\.refresh/);
    assert.doesNotMatch(sync, /document\.documentElement\.lang/);

    assert.match(route, /canonicalizeEnabledLocale/);
    assert.match(route, /buildWebHuLangCookieAttributes/);
    assert.match(prefs, /writeHuLangCookieViaWebRoute/);
  });

  it("selector placed in global header + mobile menu", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(header, /LanguageSelector/);
    assert.match(mobile, /LanguageSelector/);
    assert.match(layout, /InterfaceLanguageCookieSync/);
  });

  it("option label shows native + English when distinct", () => {
    assert.equal(
      formatLanguageOptionLabel({
        languageId: "lang-uk",
        locale: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
      }),
      "Українська (Ukrainian)",
    );
    assert.equal(
      formatLanguageOptionLabel({
        languageId: "lang-en",
        locale: "en",
        englishName: "English",
        nativeName: "English",
        textDirection: "ltr",
      }),
      "English",
    );
  });
});
