/**
 * Pack 02C Staging Acceptance Hotfix 02 — enabled-language catalog freshness.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeEnabledLocale } from "./canonicalize-locale.js";
import {
  expirePublicLanguagesClientCacheForTests,
  fetchPublicLanguagesAuthoritative,
  listSelectablePublicLanguages,
  loadEnabledPublicLocaleCatalog,
  resetPublicLanguagesCacheForTests,
} from "./public-languages-api.js";
import { resolveDocumentHtmlLocale } from "./resolve-document-locale.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

type LangRow = {
  languageId: string;
  locale: string;
  languageCode: string;
  englishName: string;
  nativeName: string;
  textDirection: "ltr" | "rtl";
  fallbackLocale: string;
  uiTranslationStatus: "none" | "partial" | "complete";
  aliases: string[];
};

function envelope(rows: readonly LangRow[]) {
  return {
    success: true,
    data: { languages: rows },
  };
}

const EN_ONLY: LangRow[] = [
  {
    languageId: "lang-en",
    locale: "en",
    languageCode: "en",
    englishName: "English",
    nativeName: "English",
    textDirection: "ltr",
    fallbackLocale: "en",
    uiTranslationStatus: "complete",
    aliases: [],
  },
];

const EN_AR: LangRow[] = [
  ...EN_ONLY,
  {
    languageId: "lang-ar",
    locale: "ar",
    languageCode: "ar",
    englishName: "Arabic",
    nativeName: "العربية",
    textDirection: "rtl",
    fallbackLocale: "en",
    uiTranslationStatus: "none",
    aliases: [],
  },
];

const EN_ZH: LangRow[] = [
  ...EN_ONLY,
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    languageCode: "zh",
    englishName: "Chinese (Traditional)",
    nativeName: "繁體中文",
    textDirection: "ltr",
    fallbackLocale: "en",
    uiTranslationStatus: "none",
    aliases: ["zh-TW", "zh-HK"],
  },
];

describe("Pack 02C Hotfix 02 — public language catalog freshness", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  let catalogSequence: LangRow[][] = [];

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetPublicLanguagesCacheForTests();
    fetchCalls = 0;
    catalogSequence = [];
  });

  function installCatalogFetch(sequence: LangRow[][]): void {
    catalogSequence = sequence;
    fetchCalls = 0;
    globalThis.fetch = (async () => {
      const rows = catalogSequence[Math.min(fetchCalls, catalogSequence.length - 1)]!;
      fetchCalls += 1;
      return new Response(JSON.stringify(envelope(rows)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  }

  it("write validation observes enable then disable without process restart", async () => {
    installCatalogFetch([EN_ONLY, EN_AR, EN_ONLY]);

    const before = await loadEnabledPublicLocaleCatalog();
    assert.deepEqual(
      before.map((row) => row.locale),
      ["en"],
    );
    assert.equal(canonicalizeEnabledLocale("ar", before), null);

    const enabled = await loadEnabledPublicLocaleCatalog();
    assert.deepEqual(
      enabled.map((row) => row.locale),
      ["en", "ar"],
    );
    assert.equal(canonicalizeEnabledLocale("ar", enabled)?.locale, "ar");

    const disabled = await loadEnabledPublicLocaleCatalog();
    assert.deepEqual(
      disabled.map((row) => row.locale),
      ["en"],
    );
    assert.equal(canonicalizeEnabledLocale("ar", disabled), null);

    // Authoritative path must hit the network on every call (no process lifetime cache).
    assert.equal(fetchCalls, 3);
  });

  it("zh-TW canonicalizes to zh-Hant immediately after zh-Hant enablement", async () => {
    installCatalogFetch([EN_ONLY, EN_ZH]);

    const before = await loadEnabledPublicLocaleCatalog();
    assert.equal(canonicalizeEnabledLocale("zh-TW", before), null);

    const after = await loadEnabledPublicLocaleCatalog();
    const canonical = canonicalizeEnabledLocale("zh-TW", after);
    assert.ok(canonical);
    assert.equal(canonical.locale, "zh-Hant");
    assert.equal(fetchCalls, 2);
  });

  it("SSR resolver observes enable/disable without process restart", async () => {
    installCatalogFetch([EN_ONLY, EN_AR, EN_ONLY]);

    // resolveDocumentHtmlLocale uses its own fetch path — inject via catalog override
    // for pure resolver behavior, then prove source does not share module cache.
    const enOnlyResolved = await resolveDocumentHtmlLocale({
      catalog: EN_ONLY.map((row) => ({
        languageId: row.languageId,
        locale: row.locale,
        textDirection: row.textDirection,
        aliases: row.aliases,
      })),
      huLangCookie: "ar",
      acceptLanguageHeader: null,
    });
    assert.equal(enOnlyResolved.locale, "en");

    const arEnabledResolved = await resolveDocumentHtmlLocale({
      catalog: EN_AR.map((row) => ({
        languageId: row.languageId,
        locale: row.locale,
        textDirection: row.textDirection,
        aliases: row.aliases,
      })),
      huLangCookie: "ar",
      acceptLanguageHeader: null,
    });
    assert.equal(arEnabledResolved.locale, "ar");
    assert.equal(arEnabledResolved.textDirection, "rtl");

    const resolverSource = readWeb("features/language/resolve-document-locale.ts");
    assert.match(resolverSource, /cache:\s*["']no-store["']/);
    assert.doesNotMatch(resolverSource, /publicLanguagesCache|clientLanguagesCache/);
    assert.doesNotMatch(resolverSource, /loadEnabledPublicLocaleCatalog/);
  });

  it("client selector keeps short TTL + in-flight dedup; expires without restart", async () => {
    installCatalogFetch([EN_ONLY, EN_AR]);

    const first = await listSelectablePublicLanguages();
    assert.deepEqual(
      first.map((row) => row.locale),
      ["en"],
    );
    const second = await listSelectablePublicLanguages();
    assert.deepEqual(
      second.map((row) => row.locale),
      ["en"],
    );
    // Same TTL window — single network call.
    assert.equal(fetchCalls, 1);

    const [a, b] = await Promise.all([
      listSelectablePublicLanguages(),
      listSelectablePublicLanguages(),
    ]);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.equal(fetchCalls, 1);

    expirePublicLanguagesClientCacheForTests();
    const third = await listSelectablePublicLanguages();
    assert.deepEqual(
      third.map((row) => row.locale),
      ["en", "ar"],
    );
    assert.equal(fetchCalls, 2);
  });

  it("authoritative fetch is independent of client TTL cache", async () => {
    installCatalogFetch([EN_ONLY, EN_AR]);

    await listSelectablePublicLanguages();
    assert.equal(fetchCalls, 1);

    // Client cache still warm with en-only; write validation must still see ar.
    catalogSequence = [EN_AR];
    const authoritative = await fetchPublicLanguagesAuthoritative();
    assert.deepEqual(
      authoritative.languages.map((row) => row.locale),
      ["en", "ar"],
    );
    assert.equal(fetchCalls, 2);
  });

  it("hu-lang route and public API wire Hotfix 02 freshness contract", () => {
    const route = readWeb("app/api/hu-lang/route.ts");
    const publicApi = readWeb("features/language/public-languages-api.ts");

    assert.match(route, /loadEnabledPublicLocaleCatalog/);
    assert.match(route, /Hotfix 02/);
    assert.match(publicApi, /fetchPublicLanguagesAuthoritative/);
    assert.match(publicApi, /PUBLIC_LANGUAGES_CLIENT_CACHE_TTL_MS/);
    assert.doesNotMatch(publicApi, /let publicLanguagesCache/);
    assert.match(
      publicApi,
      /loadEnabledPublicLocaleCatalog[\s\S]*fetchPublicLanguagesAuthoritative/,
    );
  });
});
