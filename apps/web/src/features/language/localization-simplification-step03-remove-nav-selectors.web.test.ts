/**
 * Localization Simplification Step 03 —
 * Remove visible LanguageSelector from public Desktop / Mobile / PWA navigation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Localization Simplification Step 03 — remove public LanguageSelector mounts", () => {
  it("Desktop header has no LanguageSelector", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.doesNotMatch(header, /LanguageSelector/);
    assert.doesNotMatch(header, /hu-language-selector/);
  });

  it("Mobile public menu has no LanguageSelector", () => {
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.doesNotMatch(mobile, /LanguageSelector/);
    assert.doesNotMatch(mobile, /hu-language-selector/);
  });

  it("PWA global menu has no LanguageSelector", () => {
    const pwa = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    assert.doesNotMatch(pwa, /LanguageSelector/);
    assert.doesNotMatch(pwa, /hu-pwa-global-menu__language/);
  });

  it("LanguageSelector implementation remains available (not deleted)", () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const barrel = readWeb("features/language/index.ts");
    assert.match(selector, /export function LanguageSelector/);
    assert.match(barrel, /export \{ LanguageSelector \}/);
  });

  it("locale resolution / cookie sync infrastructure remains", () => {
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(layout, /InterfaceLanguageCookieSync/);
    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");
    const syncCore = readWeb("features/language/presentation-locale-cookie-sync.ts");
    assert.match(sync, /runPresentationLocaleCookieSyncAttempt/);
    assert.match(sync, /shouldSuppressInterfaceLanguageCookieSyncForPath/);
    assert.match(syncCore, /writeHuLangCookieViaWebRoute/);
  });

  it("Preferences remains the participant-facing language control", () => {
    const prefs = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    assert.match(prefs, /preferredReadingLanguage|preferred-reading-language/);
    assert.match(prefs, /applyPresentationLocale/);
  });
});
