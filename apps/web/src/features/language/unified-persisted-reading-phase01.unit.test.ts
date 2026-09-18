/**
 * Version 5.0 Phase 1 — unified persisted reading (Web + PWA).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PwaPersistedOrdinaryReadingEligibility } from "@hu/types";

import { resolveLocaleSwitchNavigationHref } from "./resolve-locale-switch-navigation-href.js";
import { resolveOrdinaryReadingOwner } from "./ordinary-reading-ownership.js";
import { buildParticipantReadingLanguagePatch } from "./persist-participant-reading-language.js";
import { resolvePreferredPresentationLocale } from "./presentation-locale-cookie-sync.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "..");
const webSrc = path.resolve(featuresRoot, "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

const eligible: PwaPersistedOrdinaryReadingEligibility = {
  enabled: true,
  contentTranslationEnabled: true,
  pwaPersistedReadingEnabled: true,
  pwaPersistedReadingReady: false,
};

describe("Version 5.0 Phase 1 — unified ordinary-reading ownership", () => {
  it("1. Guest Web + uk eligible → hu-persisted", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "hu-persisted",
    );
  });

  it("2. Participant Web + ar eligible → hu-persisted", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "ar",
        sourceKind: "blog_post",
        pwaEligibility: eligible,
      }),
      "hu-persisted",
    );
  });

  it("3. standalone PWA + zh-Hant → still hu-persisted", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "zh-Hant",
        sourceKind: "civic_media",
        pwaEligibility: eligible,
      }),
      "hu-persisted",
    );
  });

  it("4. English → canonical", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "en",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "browser-native",
    );
  });

  it("5. ineligible future locale → canonical", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "ka",
        sourceKind: "initiative",
        pwaEligibility: { ...eligible, pwaPersistedReadingEnabled: false },
      }),
      "browser-native",
    );
  });

  it("6. public_news → source-original exclusion", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "public_news",
        pwaEligibility: eligible,
      }),
      "browser-native",
    );
  });

  it("15. Search/SEO flags do not determine ordinary-reading eligibility", () => {
    const ownership = readFeatures("language/ordinary-reading-ownership.ts");
    assert.doesNotMatch(ownership, /searchEnabled|seoIndexingEnabled/);
    assert.doesNotMatch(ownership, /presentationMode !== "standalone"/);
  });

  it("14. no provider-on-read on ordinary field resolve", () => {
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
    assert.match(hook, /resolveTranslatedContent/);
  });
});

describe("Version 5.0 Phase 1 — Header and Preferences one preference", () => {
  it("7–9. Guest cookie path and Participant patch are shared", () => {
    const selector = readFeatures("language/components/LanguageSelector.tsx");
    const prefs = readFeatures("preferences/components/PreferencesWorkspace.tsx");
    assert.match(selector, /readingLanguageControl:\s*true/);
    assert.match(selector, /buildParticipantReadingLanguagePatch/);
    assert.match(selector, /resolvePreferredPresentationLocale/);
    assert.doesNotMatch(selector, /interfaceLanguage: locale/);
    assert.match(prefs, /buildParticipantReadingLanguagePatch/);
    assert.match(prefs, /readingLanguageControl:\s*true/);

    const patch = buildParticipantReadingLanguagePatch("uk");
    assert.deepEqual(patch.readingLanguages, ["uk"]);
    assert.equal(patch.interfaceLanguage, "uk");
  });

  it("Header is mounted on desktop, mobile, and PWA menu", () => {
    assert.match(readWeb("design-system/components/HumanityHeader.tsx"), /LanguageSelector/);
    assert.match(
      readWeb("design-system/components/HumanityHeaderMobileMenu.tsx"),
      /LanguageSelector/,
    );
    assert.match(readWeb("features/pwa/components/PwaGlobalMenu.tsx"), /LanguageSelector/);
  });

  it("10. Guest uk → login to Participant ar: account reading language wins", () => {
    const locale = resolvePreferredPresentationLocale({
      experiencePreferences: {
        interfaceLanguage: "uk",
        readingLanguages: ["ar"],
        writingLanguages: ["en"],
        translationPreference: "preferred",
      },
    } as never);
    assert.equal(locale, "ar");
    const sync = readFeatures("language/presentation-locale-cookie-sync.ts");
    assert.match(sync, /readingLanguages\[0\]/);
    assert.match(sync, /resolvePreferredPresentationLocale/);
  });

  it("11. logout does not clear hu_lang", () => {
    const logout = readWeb("features/auth/auth-api.ts");
    const fn = logout.slice(logout.indexOf("export async function logout"));
    const body = fn.slice(0, fn.indexOf("export async function"));
    assert.doesNotMatch(body, /hu_lang|writeHuLangCookie|HU_LANG_COOKIE/);
  });

  it("SEO URL is not minted by a reading-language control", () => {
    const href = resolveLocaleSwitchNavigationHref({
      pathname: "/uk/media",
      nextLocale: "ar",
      seoIndexingEnabled: false,
    });
    assert.equal(href, "/media");
    assert.doesNotMatch(String(href), /^\/ar\//);
    const apply = readFeatures("language/apply-presentation-locale.ts");
    assert.match(apply, /readingLanguageControl === true \? false/);
  });

  it("12–13. Initiative and Civic Media still consume persisted presentation under owner", () => {
    const initiative = readFeatures(
      "public-initiative-experience/use-initiative-public-presentation.ts",
    );
    const media = readFeatures("civic-media-center/components/CivicMediaCenterPageContent.tsx");
    assert.match(initiative, /owner !== "hu-persisted"/);
    assert.match(initiative, /resolveInitiativeDetailPresentation/);
    assert.match(media, /selectCivicMediaFactCheckOrdinaryPresentation/);
    assert.match(media, /civicMediaOwner === "hu-persisted"/);
  });

  it("16. Public News card still suppresses PLP", () => {
    const news = readFeatures("public-news/use-localized-public-news-card.ts");
    assert.match(news, /plpPresentation: null/);
  });
});
