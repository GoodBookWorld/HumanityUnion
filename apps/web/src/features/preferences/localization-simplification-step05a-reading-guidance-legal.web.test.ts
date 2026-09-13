/**
 * Localization Simplification Step 05A —
 * Preferences reading guidance + Legal body browser-translation protection.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_LEGAL_FALLBACK,
  resolveLegalDocumentPresentation,
} from "../legal/resolve-legal-document-presentation.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webRoot, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function languageKeys(locale: string): Record<string, string> {
  const root = readMessages(locale);
  const preferences = root.preferences as Record<string, unknown>;
  return preferences.language as Record<string, string>;
}

describe("Localization Simplification Step 05A — reading guidance + Legal protection", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async () => {
      throw new Error("network unavailable in unit test");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Preferred Reading help is catalog-sourced (not hardcoded in PreferencesWorkspace)", () => {
    const workspace = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    const en = languageKeys("en").preferredReadingHelp ?? "";

    assert.match(workspace, /t\("language\.preferredReadingHelp"\)/);
    assert.doesNotMatch(
      workspace,
      /Choose the language you prefer to use when reading Humanity Union/,
    );
    assert.match(en, /approved names, key terms/i);
    assert.match(en, /browser to translate pages into the same language/i);
  });

  it("Writing Languages help is catalog-sourced (not hardcoded in PreferencesWorkspace)", () => {
    const workspace = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    const en = languageKeys("en").writingLanguagesHelp ?? "";

    assert.match(workspace, /t\("language\.writingLanguagesHelp"\)/);
    assert.doesNotMatch(
      workspace,
      /Add the languages you use for writing and collaboration/,
    );
    assert.match(en, /writing and collaboration/i);
    assert.match(en, /do not control your browser/i);
  });

  it("en/uk/ar/zh-Hant keep help-key parity without locale-hardcoded branches", () => {
    const workspace = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    assert.doesNotMatch(workspace, /\b(?:uk|ar|zh-Hant|ka)\b/);

    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const keys = languageKeys(locale);
      assert.ok(keys.preferredReadingHelp?.trim());
      assert.ok(keys.writingLanguagesHelp?.trim());
    }
  });

  it("LegalPageShell protects document body for published and fallback paths", () => {
    const shell = readWeb("features/legal/components/LegalPageShell.tsx");
    const privacy = readWeb("app/privacy/page.tsx");
    const terms = readWeb("app/terms/page.tsx");

    assert.match(shell, /ProtectedAuthoritativeText/);
    assert.match(
      shell,
      /ProtectedAuthoritativeText[\s\S]*className="legal-page__body"[\s\S]*\{children\}/,
    );

    // Published localized + English fallback both render as shell children.
    assert.match(privacy, /approved_localized/);
    assert.match(privacy, /EXPECTED_LEGAL_FALLBACK/);
    assert.match(privacy, /LegalPageShell/);
    assert.match(terms, /approved_localized/);
    assert.match(terms, /EXPECTED_LEGAL_FALLBACK/);
    assert.match(terms, /LegalPageShell/);

    // Body wrappers inside pages do not need a second protect layer — shell owns it.
    assert.doesNotMatch(privacy, /ProtectedAuthoritativeText/);
    assert.doesNotMatch(terms, /ProtectedAuthoritativeText/);
  });

  it("Legal chrome remains unprotected from browser translation", () => {
    const shell = readWeb("features/legal/components/LegalPageShell.tsx");
    const headerStart = shell.indexOf('<header className="legal-page__header">');
    const bodyProtectStart = shell.indexOf(
      '<ProtectedAuthoritativeText as="div" className="legal-page__body">',
    );
    assert.ok(headerStart >= 0 && bodyProtectStart > headerStart);
    const headerSlice = shell.slice(headerStart, bodyProtectStart);

    assert.match(headerSlice, /chrome\.privacyLabel/);
    assert.match(headerSlice, /chrome\.termsLabel/);
    assert.match(headerSlice, /chrome\.title/);
    assert.match(headerSlice, /chrome\.counselNote/);
    assert.doesNotMatch(headerSlice, /ProtectedAuthoritativeText/);
    assert.doesNotMatch(headerSlice, /translate=["']no["']/);
    assert.doesNotMatch(shell, /<article[^>]*translate=/);
  });

  it("existing Legal locale/fallback contract remains unchanged", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      for (const documentId of ["privacy", "terms"] as const) {
        const presentation = await resolveLegalDocumentPresentation(locale, documentId);
        assert.equal(presentation.body.source, EXPECTED_LEGAL_FALLBACK);
        assert.equal(presentation.body.localizedBodyHtml, null);
        assert.equal(presentation.locale, locale);
        assert.ok(presentation.chrome.title.trim());
      }
    }
  });
});
