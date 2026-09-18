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
    const apply = readWeb("features/language/apply-presentation-locale.ts");
    const nav = readWeb("features/language/run-locale-switch-navigation.ts");

    assert.match(selector, /applyPresentationLocale/);
    assert.match(selector, /updateMyPreferences/);
    assert.match(apply, /writeHuLangCookieViaWebRoute/);
    assert.match(apply, /runLocaleSwitchNavigation/);
    assert.match(nav, /router\.refresh/);
    assert.doesNotMatch(selector, /document\.documentElement/);
    assert.doesNotMatch(selector, /normalizeLanguageCode/);

    assert.match(sync, /getMyPreferences/);
    assert.match(sync, /runPresentationLocaleCookieSyncAttempt/);
    assert.match(sync, /router\.refresh/);
    assert.doesNotMatch(sync, /document\.documentElement\.lang/);
    const syncCore = readWeb("features/language/presentation-locale-cookie-sync.ts");
    assert.match(syncCore, /writeHuLangCookieViaWebRoute/);
    assert.match(syncCore, /currentCookie === target/);

    assert.match(route, /canonicalizeEnabledLocale/);
    assert.match(route, /buildWebHuLangCookieAttributes/);
    // Step 06A.3 — Preferences uses shared applyPresentationLocale (cookie + navigation).
    assert.match(prefs, /applyPresentationLocale/);
    assert.match(prefs, /forceSamePathRecompose:\s*true/);
    assert.doesNotMatch(
      prefs.slice(prefs.indexOf("async function handleSubmit")),
      /writeHuLangCookieViaWebRoute\(/,
    );
  });

  it("public Desktop/Mobile navigation mounts the shared LanguageSelector", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(header, /LanguageSelector/);
    assert.match(mobile, /LanguageSelector/);
    assert.match(layout, /InterfaceLanguageCookieSync/);
  });

  it("LanguageSelector viewport-safe CSS remains for non-header consumers", () => {
    const css = readWeb("features/language/components/language-selector.css");

    // Historical dropdown alignment remains absolute + inset-inline-start.
    // Open overlay lists are then clamped in place-language-selector-list.ts.
    assert.match(
      css,
      /\.hu-language-selector__list\s*\{[^}]*position:\s*absolute[^}]*inset-inline-start:\s*0/s,
    );
    assert.match(css, /--hu-language-selector-visible-rows:\s*10/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /hu-language-selector--mobile[\s\S]*position:\s*static/);
    assert.doesNotMatch(css, /inset-inline:\s*4vw/);
  });

  it("PWA standalone burger Global Menu mounts the shared LanguageSelector", () => {
    const safeArea = readWeb("features/pwa/pwa-safe-area.css");
    const pwaHeader = readWeb("features/pwa/components/PwaAppHeader.tsx");
    const globalMenu = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    const css = readWeb("features/language/components/language-selector.css");
    const pwaCss = readWeb("features/pwa/pwa.css");

    // Standalone hides HumanityHeader — language control is Preferences, not nav.
    assert.match(
      safeArea,
      /\.humanity-app--pwa-standalone\s+\.humanity-header[\s\S]*display:\s*none/,
    );
    assert.match(pwaHeader, /PwaGlobalMenu/);
    assert.match(globalMenu, /LanguageSelector/);
    assert.match(globalMenu, /hu-pwa-global-menu__language/);
    assert.match(globalMenu, /hu-language-selector--mobile/);
    assert.doesNotMatch(globalMenu, /variant="icon"/);
    assert.match(css, /hu-language-selector--mobile[\s\S]*position:\s*static/);
    assert.match(css, /hu-language-selector--mobile[\s\S]*100dvh - 5rem/);
    assert.match(css, /hu-language-selector__select[\s\S]*inset 0 1px 2px/);
    assert.match(pwaCss, /hu-pwa-global-menu__panel[\s\S]*inset-inline-end:\s*0/);
  });

  it("mobile icon variant reuses Registry list + existing locale switch path", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const css = readWeb("features/language/components/language-selector.css");
    const layoutCss = readWeb("design-system/layout.css");
    assert.match(selector, /variant\?:\s*"default"\s*\|\s*"icon"/);
    assert.match(selector, /\/icons\/messenger\/language\.png/);
    assert.match(selector, /listSelectablePublicLanguages/);
    assert.match(selector, /applyPresentationLocale/);
    assert.match(css, /hu-language-selector--mobile[\s\S]*overflow-y:\s*auto/);
    assert.match(layoutCss, /humanity-header__mobile-panel[\s\S]*overflow-y:\s*auto/);
  });

  it("option label shows native + English when distinct", () => {
    assert.equal(
      formatLanguageOptionLabel({
        languageId: "lang-uk",
        locale: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
        seoIndexingEnabled: true,
        contentTranslationEnabled: false,
        pwaPersistedReadingEnabled: false,
        pwaPersistedReadingReady: false,
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
        seoIndexingEnabled: true,
        contentTranslationEnabled: false,
        pwaPersistedReadingEnabled: false,
        pwaPersistedReadingReady: false,
      }),
      "English",
    );
  });

  it("LanguageSelector reading control does not mint SEO locale URLs", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const api = readWeb("features/language/public-languages-api.ts");
    const href = readWeb("features/language/resolve-locale-switch-navigation-href.ts");
    assert.match(api, /seoIndexingEnabled:\s*row\.seoIndexingEnabled\s*===\s*true/);
    assert.match(selector, /readingLanguageControl:\s*true/);
    assert.match(selector, /seoIndexingEnabled:\s*false/);
    assert.doesNotMatch(selector, /seoIndexingEnabled:\s*selected\?\.seoIndexingEnabled/);
    assert.match(href, /seoIndexingEnabled\s*!==\s*true/);
    assert.doesNotMatch(href, /\bka\b/);
    assert.doesNotMatch(selector, /\bka\.json\b/);
  });
});
