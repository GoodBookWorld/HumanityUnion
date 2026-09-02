/**
 * Pack 02G Task 08G — Preferences form body + PWA non-Assistant chrome localization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(
  messages: Record<string, unknown>,
  dottedPath: string,
): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const PREFERENCE_SAMPLE_KEYS = [
  "preferences.title",
  "preferences.subtitle",
  "preferences.save",
  "preferences.sections.language",
  "preferences.sections.experience",
  "preferences.sections.participation",
  "preferences.sections.communication",
  "preferences.sections.notification",
  "preferences.sections.accessibility",
  "preferences.sections.visibility",
  "preferences.translationPreferences.none",
  "preferences.translationPreferences.preferred",
  "preferences.translationPreferences.ask",
  "preferences.contribution.analysis",
  "preferences.notificationFrequencies.daily_digest",
  "preferences.contentDensity.comfortable",
  "preferences.visibilityOptions.members_only",
  "preferences.geography.preferredCountries",
] as const;

const PWA_SAMPLE_KEYS = [
  "pwa.appNavAria",
  "pwa.create",
  "pwa.createInitiativeAria",
  "pwa.searchLabel",
  "pwa.goBack",
  "pwa.openMenu",
  "pwa.closeMenu",
  "pwa.menuTitle",
  "pwa.playIntroSound",
  "pwa.sound",
  "pwa.install.appTitle",
  "pwa.install.installCta",
  "pwa.install.guideTitle",
  "pwa.install.closeGuideAria",
  "pwa.feed.title",
  "pwa.feed.loading",
  "pwa.feed.viewAll",
] as const;

describe("Pack 02G Task 08G — Preferences + PWA chrome", () => {
  it("catalog parity includes preferences.* and pwa.*", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [...PREFERENCE_SAMPLE_KEYS, ...PWA_SAMPLE_KEYS]) {
        assert.equal(typeof readNested(loaded.messages as Record<string, unknown>, key), "string");
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("Ukrainian preferences / PWA chrome resolve without English leftovers", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const messages = uk.messages as Record<string, unknown>;
    assert.doesNotMatch(readNested(messages, "preferences.sections.language"), /Language & Translation/);
    assert.doesNotMatch(readNested(messages, "preferences.save"), /Save Preferences/);
    assert.match(readNested(messages, "preferences.save"), /Зберегти/i);
    assert.doesNotMatch(readNested(messages, "pwa.createInitiativeAria"), /Create Initiative/);
    assert.match(readNested(messages, "pwa.create"), /Створити/);
  });

  it("PreferencesWorkspace uses translations for section titles / save", () => {
    const workspace = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    assert.match(workspace, /useTranslations\("preferences"\)/);
    assert.match(workspace, /sections\.language/);
    assert.match(workspace, /sections\.experience/);
    assert.match(workspace, /sections\.participation/);
    assert.match(workspace, /t\("save"\)/);
    assert.match(workspace, /resolveSaveButtonLabel/);
    assert.match(workspace, /resolveActivityAreaDisplayLabel/);
    assert.match(workspace, /translationPreferences\./);
    assert.match(workspace, /geography\.\$\{scope\}/);
    assert.doesNotMatch(workspace, /"Language & Translation"/);
    assert.doesNotMatch(workspace, /"Save Preferences"/);
    assert.doesNotMatch(workspace, />\s*Language & Translation\s*</);
    assert.doesNotMatch(workspace, /resolveSaveButtonLabel\([^)]*"Save Preferences"/);

    const geography = readWeb("features/preferences/components/PreferredGeographyFields.tsx");
    assert.match(geography, /useTranslations\("preferences"\)/);
    assert.match(geography, /manage\.geography\./);
    assert.doesNotMatch(geography, /GEOGRAPHY_EMPTY_COPY/);

    const page = readWeb("app/preferences/page.tsx");
    assert.match(page, /getTranslations\("preferences"\)/);
    assert.match(page, /t\("title"\)/);
    assert.match(page, /t\("subtitle"\)/);
    assert.doesNotMatch(page, /title="Preferences"/);
  });

  it("PwaBottomNav uses catalog for Create aria", () => {
    const nav = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(nav, /useTranslations\("pwa"\)/);
    assert.match(nav, /createInitiativeAria/);
    assert.match(nav, /tPwa\("create"\)/);
    assert.match(nav, /appNavAria/);
    assert.doesNotMatch(nav, /aria-label="Create Initiative"/);
    assert.doesNotMatch(nav, />\s*Create\s*</);
    assert.doesNotMatch(nav, /aria-label="App"/);

    const header = readWeb("features/pwa/components/PwaAppHeader.tsx");
    assert.match(header, /searchLabel|searchPlaceholder/);
    assert.match(header, /goBack/);
    assert.doesNotMatch(header, /placeholder="Search Humanity Union"/);

    const menu = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    assert.match(menu, /useTranslations\("navigation"\)/);
    assert.match(menu, /menuTitle/);
    assert.doesNotMatch(menu, /label: "Home"/);

    const feed = readWeb("features/pwa/components/PwaInitiativeFeed.tsx");
    assert.match(feed, /useTranslations\("pwa"\)/);
    assert.match(feed, /feed\.title/);
    assert.match(feed, /feed\.matchedPriorities/);
    assert.doesNotMatch(feed, />Initiatives</);
  });
});
