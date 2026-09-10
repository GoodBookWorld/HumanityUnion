/**
 * Localization repair — structured CT resolve must not present partial CURRENT.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStructuredTranslatedDisplay } from "../../../src/modules/language/resolve-translated-display.js";
import type { TranslatedContentRecord } from "@hu/types";

function translation(fields: Record<string, string>): TranslatedContentRecord {
  return {
    translationId: "t1",
    sourceKind: "collaborative_analysis",
    sourceRecordId: "ca-1",
    sourceLanguage: "en",
    targetLanguage: "ar",
    sourceVersion: "v1",
    translatedContent: fields,
    translationProvider: "deterministic",
    translationKind: "machine",
    freshness: "current",
    stale: false,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("resolveStructuredTranslatedDisplay — field completeness", () => {
  it("rejects partial CURRENT bags (uk-vs-ar Supporting Arguments asymmetry)", () => {
    const originalFields = {
      title: "Analysis title",
      summary: "Summary prose",
      supportingEvidence: "Supporting Arguments body",
      risks: "Risks body",
    };
    const resolved = resolveStructuredTranslatedDisplay({
      originalFields,
      originalLanguage: "en",
      preferredReadingLanguage: "ar",
      translations: [
        translation({
          title: "عنوان",
          summary: "ملخص",
          // supportingEvidence intentionally omitted — partial CURRENT
          risks: "مخاطر",
        }),
      ],
    });
    assert.equal(resolved.presentationMode, "original");
    assert.equal(resolved.isStale, true);
    assert.equal(resolved.isMachineTranslated, false);
    assert.equal(resolved.content.supportingEvidence, "Supporting Arguments body");
    assert.equal(resolved.activeLanguage, "en");
  });

  it("accepts complete CURRENT bags for every locale path equally", () => {
    const originalFields = {
      title: "Analysis title",
      summary: "Summary prose",
      supportingEvidence: "Supporting Arguments body",
      risks: "Risks body",
    };
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const resolved = resolveStructuredTranslatedDisplay({
        originalFields,
        originalLanguage: "en",
        preferredReadingLanguage: locale,
        translations: [
          {
            ...translation({
              title: `title-${locale}`,
              summary: `summary-${locale}`,
              supportingEvidence: `supporting-${locale}`,
              risks: `risks-${locale}`,
            }),
            targetLanguage: locale,
          },
        ],
      });
      assert.equal(resolved.presentationMode, "preferred_translation");
      assert.equal(resolved.content.supportingEvidence, `supporting-${locale}`);
      assert.equal(resolved.activeLanguage, locale);
      assert.equal(resolved.isMachineTranslated, true);
    }
  });
});
