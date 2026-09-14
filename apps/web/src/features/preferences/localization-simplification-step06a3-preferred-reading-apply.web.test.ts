/**
 * Localization Simplification Step 06A.3 —
 * Preferences applies Preferred Reading via shared presentation-locale path.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale.js";
import { resolveLocaleSwitchNavigationHref } from "../language/resolve-locale-switch-navigation-href.js";
import { runLocaleSwitchNavigation } from "../language/run-locale-switch-navigation.js";
import { applyPresentationLocale } from "../language/apply-presentation-locale.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Localization Simplification Step 06A.3 — Preferred Reading presentation apply", () => {
  it("A. Preferences save applies presentation locale via shared helper (not bare refresh)", () => {
    const prefs = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const handleSubmit = prefs.slice(prefs.indexOf("async function handleSubmit"));
    const apply = readWeb("src/features/language/apply-presentation-locale.ts");

    assert.match(prefs, /applyPresentationLocale/);
    assert.match(prefs, /listSelectablePublicLanguages/);
    assert.match(handleSubmit, /updateMyPreferences/);
    assert.match(handleSubmit, /applyPresentationLocale\(/);
    assert.match(handleSubmit, /forceSamePathRecompose:\s*true/);
    assert.match(handleSubmit, /seoIndexingEnabled:\s*selected\?\.seoIndexingEnabled === true/);
    assert.doesNotMatch(handleSubmit, /writeHuLangCookieViaWebRoute\(/);
    assert.doesNotMatch(handleSubmit, /router\.refresh\(\)/);

    assert.match(apply, /writeHuLangCookieViaWebRoute/);
    assert.match(apply, /claimAuthoritativePresentationLocale|markInterfaceLanguageCookieSynced/);
  });

  it("A. shared apply writes cookie then navigates for arbitrary non-SEO Registry locale", async () => {
    const calls: string[] = [];
    const writtenLocales: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/hu-lang") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as { locale?: string };
        const locale = body.locale?.trim() || "en";
        writtenLocales.push(locale);
        return new Response(
          JSON.stringify({
            success: true,
            data: { locale, languageId: `lang-${locale}`, textDirection: "ltr" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const result = await applyPresentationLocale({
        locale: "xx-TEST",
        pathname: "/preferences",
        seoIndexingEnabled: false,
        router: {
          replace: (href) => {
            calls.push(`replace:${href}`);
          },
          refresh: () => {
            calls.push("refresh");
          },
        },
        markAuthenticatedSync: true,
        forceSamePathRecompose: true,
      });

      assert.equal(result.written.locale, "xx-TEST");
      assert.deepEqual(writtenLocales, ["xx-TEST"]);
      assert.equal(result.href, null);
      assert.equal(result.didReplace, true);
      assert.equal(result.didRefresh, true);
      assert.deepEqual(calls, ["replace:/preferences", "refresh"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("B. Registry textDirection rtl reaches document locale without hardcoded RTL lists", async () => {
    const catalog = [
      {
        languageId: "lang-en",
        locale: "en",
        textDirection: "ltr" as const,
        aliases: [],
      },
      {
        languageId: "lang-future-rtl",
        locale: "xx-RTL",
        textDirection: "rtl" as const,
        aliases: [],
      },
    ];
    const resolved = await resolveDocumentHtmlLocale({
      catalog,
      huLangCookie: "xx-RTL",
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "xx-RTL");
    assert.equal(resolved.textDirection, "rtl");

    const layout = readWeb("src/app/layout.tsx");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.doesNotMatch(layout, /RTL_LANGUAGE_CODES|isRtlLanguageCode/);

    const apply = readWeb("src/features/language/apply-presentation-locale.ts");
    assert.doesNotMatch(apply, /RTL_LANGUAGE_CODES|isRtlLanguageCode|"he"|"ka"/);
  });

  it("C. Brand request follows presentation/document locale (layout + client hook)", () => {
    const layout = readWeb("src/app/layout.tsx");
    const hook = readWeb("src/features/brand-localization/useLocalizedBrand.ts");
    assert.match(layout, /resolveBrandForMetadata\(documentLocale\.locale\)/);
    assert.match(hook, /useLocale\(\)/);
    assert.match(hook, /resolveLocalizedBrandForLocale\(locale\)/);
  });

  it("D. apply path does not gate on Extended Localization / DATA_NOT_READY / WEB_UI", () => {
    const apply = readWeb("src/features/language/apply-presentation-locale.ts");
    const prefs = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    for (const src of [apply, prefs]) {
      assert.doesNotMatch(src, /DATA_NOT_READY|languageDataReady|WEB_UI|Activate Localization|isLocalizationReady/);
    }
  });

  it("E. SEO-indexable locale still uses existing locale navigation rules", () => {
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/media",
        nextLocale: "uk",
        seoIndexingEnabled: true,
      }),
      "/uk/media",
    );
    assert.equal(
      resolveLocaleSwitchNavigationHref({
        pathname: "/uk/media",
        nextLocale: "xx-TEST",
        seoIndexingEnabled: false,
      }),
      "/media",
    );

    const calls: string[] = [];
    const result = runLocaleSwitchNavigation({
      router: {
        replace: (href) => {
          calls.push(`replace:${href}`);
        },
        refresh: () => {
          calls.push("refresh");
        },
      },
      pathname: "/media",
      href: "/uk/media",
    });
    assert.equal(result.didReplace, true);
    assert.deepEqual(calls, ["replace:/uk/media", "refresh"]);
  });

  it("F. Step 06A Search readiness predicate remains Enabled-only", () => {
    const readiness = readFileSync(
      path.resolve(webRoot, "../../packages/types/src/domain/language-localization-readiness.ts"),
      "utf8",
    );
    assert.match(
      readiness,
      /export function isLocalizationReadyForSearch\([\s\S]*?return report\.registry\.enabled === true;/,
    );
    assert.doesNotMatch(
      readiness.slice(readiness.indexOf("export function isLocalizationReadyForSearch")),
      /isLocalizationReadyForSeo\(report\)/,
    );
  });

  it("G. no ka/he special cases in Preferences apply or shared helper", () => {
    const prefs = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");
    const apply = readWeb("src/features/language/apply-presentation-locale.ts");
    const nav = readWeb("src/features/language/run-locale-switch-navigation.ts");
    for (const src of [prefs, apply, nav]) {
      assert.doesNotMatch(src, /["']ka["']|["']he["']/);
    }
  });

  it("LanguageSelector remains unmounted in public navigation", () => {
    const header = readWeb("src/design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("src/design-system/components/HumanityHeaderMobileMenu.tsx");
    const pwa = readWeb("src/features/pwa/components/PwaGlobalMenu.tsx");
    assert.doesNotMatch(header, /LanguageSelector/);
    assert.doesNotMatch(mobile, /LanguageSelector/);
    assert.doesNotMatch(pwa, /LanguageSelector/);
  });

  it("forceSamePathRecompose replaces then refreshes when href is null/same", () => {
    const calls: string[] = [];
    const result = runLocaleSwitchNavigation({
      router: {
        replace: (href) => {
          calls.push(`replace:${href}`);
        },
        refresh: () => {
          calls.push("refresh");
        },
      },
      pathname: "/preferences",
      href: null,
      forceSamePathRecompose: true,
    });
    assert.equal(result.didReplace, true);
    assert.equal(result.didRefresh, true);
    assert.deepEqual(calls, ["replace:/preferences", "refresh"]);
  });
});
