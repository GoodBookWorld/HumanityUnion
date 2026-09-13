/**
 * Localization Simplification Step 01 — Preferences Language & Translation UI.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      path.join(webRoot, `src/features/i18n/messages/${locale}.json`),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

function languageKeys(locale: string): Record<string, string> {
  const root = readMessages(locale);
  const preferences = root.preferences as Record<string, unknown>;
  return preferences.language as Record<string, string>;
}

describe("Localization Simplification Step 01 — Preferences preferred reading UI", () => {
  it("Preferred Reading Language is the visible primary control with label association", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");

    assert.match(src, /htmlFor="pref-preferred-reading-language"/);
    assert.match(src, /id="pref-preferred-reading-language"/);
    assert.match(src, /aria-describedby="pref-preferred-reading-language-help"/);
    assert.match(src, /language\.preferredReadingHelp/);
    assert.match(src, /preferences-workspace__field--primary/);
    assert.match(src, /readingLanguages:\s*\[locale\]/);
    assert.match(src, /interfaceLanguage:\s*locale/);
  });

  it("hides Interface Language and Translation Preference controls while still saving experiencePreferences", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");

    assert.doesNotMatch(src, /language\.interfaceLanguage/);
    assert.doesNotMatch(src, /language\.translationPreference/);
    assert.doesNotMatch(src, /TRANSLATION_PREFERENCE_CODES/);
    assert.match(src, /experiencePreferences:\s*preferences\.experiencePreferences/);
    assert.match(
      src,
      /writeHuLangCookieViaWebRoute\(\s*updated\.experiencePreferences\.interfaceLanguage/,
    );
  });

  it("Writing Languages remains visible with associated help", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");

    assert.match(src, /htmlFor="pref-writing-languages"/);
    assert.match(src, /id="pref-writing-languages"/);
    assert.match(src, /language\.writingLanguagesHelp/);
  });

  it("does not silently display English when persisted reading locale is absent from options", () => {
    const src = readWeb("src/features/preferences/components/PreferencesWorkspace.tsx");

    assert.match(src, /language\.savedUnavailable|savedUnavailable/);
    assert.match(src, /language\.savedReadingHelp|savedReadingHelp/);
    assert.doesNotMatch(
      src,
      /readingLanguages\[0\] \?\? "en"[\s\S]{0,120}languageOptions\[0\]\?\.code \?\? "en"/,
    );
  });

  it("catalog keys preferredReadingHelp + writingLanguagesHelp have en/uk/ar/zh-Hant parity", () => {
    const locales = ["en", "uk", "ar", "zh-Hant"] as const;
    const required = [
      "help",
      "preferredReadingLanguage",
      "preferredReadingHelp",
      "writingLanguages",
      "writingLanguagesHelp",
      "interfaceLanguage",
      "translationPreference",
    ] as const;

    for (const locale of locales) {
      const keys = languageKeys(locale);
      for (const key of required) {
        assert.equal(typeof keys[key], "string", `${locale}.language.${key}`);
        assert.ok(keys[key]!.trim().length > 0, `${locale}.language.${key} non-empty`);
      }
    }

    const enHelp = languageKeys("en").preferredReadingHelp ?? "";
    assert.match(enHelp, /preferred language for Humanity Union/i);
    assert.match(enHelp, /browser language/i);
  });

  it("Header / PWA LanguageSelector mounts remain present (out of scope)", () => {
    const layout = readWeb("src/design-system/components/HumanityLayout.tsx");
    const header = readWeb("src/design-system/components/HumanityHeader.tsx");
    const pwaMenu = readWeb("src/features/pwa/components/PwaGlobalMenu.tsx");
    assert.match(layout, /InterfaceLanguageCookieSync/);
    assert.match(header, /LanguageSelector/);
    assert.match(pwaMenu, /LanguageSelector/);
  });

  it("SEO cookie sync suppression path remains intact", () => {
    const sync = readWeb(
      "src/features/language/components/InterfaceLanguageCookieSync.tsx",
    );
    assert.match(sync, /shouldSuppressInterfaceLanguageCookieSyncForPath/);
  });
});
