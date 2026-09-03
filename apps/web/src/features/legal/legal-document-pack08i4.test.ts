/**
 * Pack 08I.4 — legal document presentation: no Gemini, expected_legal_fallback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVED_LOCALIZED_LEGAL_BODIES,
  EXPECTED_LEGAL_FALLBACK,
  resolveLegalDocumentPresentation,
} from "./resolve-legal-document-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 08I.4 — legal document localization fallback", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async () => {
      throw new Error("network unavailable in unit test");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exports EXPECTED_LEGAL_FALLBACK contract token", () => {
    assert.equal(EXPECTED_LEGAL_FALLBACK, "expected_legal_fallback");
  });

  it("approved localized legal bodies map stays empty (no fabricated translations)", () => {
    assert.deepEqual(APPROVED_LOCALIZED_LEGAL_BODIES, {});
    assert.equal(Object.keys(APPROVED_LOCALIZED_LEGAL_BODIES).length, 0);
  });

  it("resolveLegalDocumentPresentation returns expected_legal_fallback for all locales", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      for (const documentId of ["privacy", "terms"] as const) {
        const presentation = await resolveLegalDocumentPresentation(locale, documentId);
        assert.equal(presentation.body.source, EXPECTED_LEGAL_FALLBACK);
        assert.equal(presentation.body.localizedBodyHtml, null);
        assert.equal(typeof presentation.chrome.title, "string");
        assert.ok(presentation.chrome.title.length > 0);
        assert.equal(typeof presentation.chrome.counselNote, "string");
        assert.equal(typeof presentation.chrome.privacyLabel, "string");
        assert.equal(typeof presentation.chrome.termsLabel, "string");
        assert.match(presentation.chrome.expectedFallbackNote, /expected_legal_fallback/);
      }
    }
  });

  it("legal helper and pages never call Gemini / fabricate provider translation", () => {
    const helper = readWeb("features/legal/resolve-legal-document-presentation.ts");
    const shell = readWeb("features/legal/components/LegalPageShell.tsx");
    const privacy = readWeb("app/privacy/page.tsx");
    const terms = readWeb("app/terms/page.tsx");

    for (const source of [helper, shell, privacy, terms]) {
      assert.doesNotMatch(source, /generateContentTranslation/);
      assert.doesNotMatch(source, /from\s+["'][^"']*gemini/i);
      assert.doesNotMatch(source, /providerId:\s*["']gemini["']/);
      assert.doesNotMatch(source, /google_cloud|deepl/);
    }

    assert.match(helper, /EXPECTED_LEGAL_FALLBACK/);
    assert.match(helper, /APPROVED_LOCALIZED_LEGAL_BODIES/);
    assert.match(helper, /Do NOT call Gemini/);
    assert.match(privacy, /resolveLegalDocumentPresentation/);
    assert.match(terms, /resolveLegalDocumentPresentation/);
    assert.match(privacy, /EXPECTED_LEGAL_FALLBACK/);
    assert.match(terms, /EXPECTED_LEGAL_FALLBACK/);
    assert.match(shell, /legalPublic|presentation\.chrome|navAriaLabel/);
  });

  it("LegalPageShell localizes chrome nav from presentation contract", () => {
    const shell = readWeb("features/legal/components/LegalPageShell.tsx");
    assert.match(shell, /chrome\.privacyLabel/);
    assert.match(shell, /chrome\.termsLabel/);
    assert.match(shell, /chrome\.counselNote/);
    assert.match(shell, /data-legal-body-source=\{EXPECTED_LEGAL_FALLBACK\}/);
  });
});
