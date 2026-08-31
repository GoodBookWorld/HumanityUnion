/**
 * Production Completion Pack 02C Task 04 — local acceptance: one coherent locale runtime.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveRuntimeLocaleFromCatalog,
  type RuntimeLocaleCatalogEntry,
} from "@hu/types";

import { canonicalizeEnabledLocale } from "./canonicalize-locale.js";
import { resolveDocumentHtmlLocale } from "./resolve-document-locale.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const apiSrc = path.resolve(here, "../../../../api/src");
const typesRuntimePath = path.resolve(
  here,
  "../../../../../packages/types/src/domain/runtime-locale.ts",
);

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

/** Catalog as if Admin enabled verification locales (seeds stay disabled in real envs). */
const ENABLED_CATALOG: readonly RuntimeLocaleCatalogEntry[] = [
  { languageId: "lang-en", locale: "en", textDirection: "ltr", aliases: [] },
  { languageId: "lang-uk", locale: "uk", textDirection: "ltr", aliases: [] },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
  },
  { languageId: "lang-ar", locale: "ar", textDirection: "rtl", aliases: [] },
];

describe("Production Completion Pack 02C Task 04 — local acceptance", () => {
  it("A — Guest English → lang=en dir=ltr", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: ENABLED_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: null,
    });
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.textDirection, "ltr");
  });

  it("B — Guest ar cookie → SSR lang=ar dir=rtl", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: ENABLED_CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.textDirection, "rtl");
    assert.equal(resolved.source, "cookie");
  });

  it("C — zh-TW alias → canonical zh-Hant for cookie + SSR", async () => {
    const canonical = canonicalizeEnabledLocale("zh-TW", ENABLED_CATALOG);
    assert.ok(canonical);
    assert.equal(canonical.locale, "zh-Hant");

    const ssr = await resolveDocumentHtmlLocale({
      catalog: ENABLED_CATALOG,
      huLangCookie: canonical.locale,
      acceptLanguageHeader: "zh-TW",
    });
    assert.equal(ssr.locale, "zh-Hant");
    assert.notEqual(ssr.locale, "zh");
  });

  it("D — Authenticated Participant uk: SSR + API catalog agree", () => {
    const apiShape = resolveRuntimeLocaleFromCatalog(
      {
        authenticated: true,
        participantInterfaceLanguage: "uk",
        huLangCookie: "uk",
        acceptLanguageHeader: "ar",
      },
      ENABLED_CATALOG,
    );
    assert.equal(apiShape.locale, "uk");
    assert.equal(apiShape.source, "participant");

    // Web SSR uses cookie after login sync (same canonical locale).
    const webShape = resolveRuntimeLocaleFromCatalog(
      {
        authenticated: false,
        huLangCookie: "uk",
        acceptLanguageHeader: "ar",
      },
      ENABLED_CATALOG,
    );
    assert.equal(webShape.locale, apiShape.locale);
    assert.equal(webShape.locale, "uk");
  });

  it("E — Disabled locale cannot resolve / falls through", async () => {
    const enabledOnlyEn = ENABLED_CATALOG.filter((row) => row.locale === "en");
    assert.equal(canonicalizeEnabledLocale("uk", enabledOnlyEn), null);
    assert.equal(canonicalizeEnabledLocale("ar", enabledOnlyEn), null);

    const ssr = await resolveDocumentHtmlLocale({
      catalog: enabledOnlyEn,
      huLangCookie: "uk",
      acceptLanguageHeader: "ar,uk;q=0.9",
    });
    assert.equal(ssr.locale, "en");
  });

  it("F — Login sync: no documentElement mutation; latch + skip when cookie matches", () => {
    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");
    assert.match(sync, /lastSyncedInterfaceLocale/);
    assert.match(sync, /currentCookie === interfaceLanguage/);
    assert.match(sync, /writeHuLangCookieViaWebRoute/);
    assert.match(sync, /router\.refresh/);
    assert.doesNotMatch(sync, /document\.documentElement/);
    assert.match(sync, /authStatus === "unauthenticated"/);
  });

  it("ONE canonical resolution path — shared catalog resolver", () => {
    const typesRuntime = readFileSync(typesRuntimePath, "utf8");
    const apiResolve = readApi("modules/language/resolve-runtime-locale.ts");
    const webResolve = readWeb("features/language/resolve-document-locale.ts");
    assert.match(typesRuntime, /resolveRuntimeLocaleFromCatalog/);
    assert.match(apiResolve, /resolveRuntimeLocaleFromCatalog/);
    assert.match(webResolve, /resolveRuntimeLocaleFromCatalog/);
  });

  it("Pack 02C runtime paths: no base-tag collapse / no client lang mutation / no hardcoded catalogs", () => {
    const pack02cFiles = [
      "features/language/resolve-document-locale.ts",
      "features/language/components/LanguageSelector.tsx",
      "features/language/components/InterfaceLanguageCookieSync.tsx",
      "features/language/components/DocumentLanguageAttributes.tsx",
      "features/language/canonicalize-locale.ts",
      "app/api/hu-lang/route.ts",
      "app/layout.tsx",
    ];

    for (const file of pack02cFiles) {
      const src = readWeb(file);
      assert.doesNotMatch(src, /normalizeLanguageCode/, file);
      assert.doesNotMatch(src, /document\.documentElement\.(lang|dir)/, file);
      assert.doesNotMatch(src, /PRIORITY_LANGUAGE_CATALOG/, file);
    }

    const docAttrs = readWeb("features/language/components/DocumentLanguageAttributes.tsx");
    assert.match(docAttrs, /return null/);
  });

  it("auth scope not broadened for locale sync", () => {
    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");
    assert.match(sync, /getMyPreferences/);
    assert.doesNotMatch(sync, /accessCookie|refreshCookie|extractAccessToken/);
    assert.match(sync, /Does not read API host-only auth cookies/);
  });
});
