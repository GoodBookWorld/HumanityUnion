/**
 * F.3.31C.1 — a terminology-only attempt of the current source and input
 * does not leave an otherwise presentation-eligible stored row in work.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TerminologyConcept, TranslatedContentRecord } from "@hu/types";

import { decideSameVersionWarmFailureRetry } from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  classifyContentTranslationForReconciliation,
  type AttemptedCurrentInputFailure,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  buildLocalizationInputVersionFromConcepts,
  collectSourceTextLeaves,
} from "../../../src/modules/language/localization-input-contract.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const concept: TerminologyConcept = {
  conceptId: "humanity_union",
  canonicalEnglishTerm: "Humanity Union",
  category: "brand",
  status: "published",
  translations: {
    uk: { preferredTerm: "Союз Людства", aliases: [] },
    ar: { preferredTerm: "اتحاد الإنسانية", aliases: [] },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const originalFields = {
  title: "Development of the Humanity Union platform",
  description: "Neighbors restore a river.",
};

const localizedFields = {
  title: "Розвиток платформи спільноти",
  description: "Сусідська робота",
};

function storedRow(): TranslatedContentRecord {
  return {
    translationId: "t-uk",
    sourceKind: "collaborative_analysis",
    sourceRecordId: "analysis-f331c1",
    sourceVersion: "v-current",
    sourceLanguage: "en",
    targetLanguage: "uk",
    translatedContent: localizedFields,
    translationProvider: "gemini",
    translationKind: "machine",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    stale: false,
    freshness: "current",
    localizationInputVersion: "stored-older-input",
  };
}

function liveInputVersion(): string {
  return buildLocalizationInputVersionFromConcepts({
    sourceVersion: "v-current",
    targetLocale: "uk",
    concepts: [concept],
    sourceText: collectSourceTextLeaves(originalFields),
  }).localizationInputVersion;
}

function terminologyAttempt(
  overrides: Partial<AttemptedCurrentInputFailure> = {},
): AttemptedCurrentInputFailure {
  return {
    failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
    sourceVersion: "v-current",
    localizationInputVersion: liveInputVersion(),
    targetLocale: "uk",
    ...overrides,
  };
}

function classify(attempted: AttemptedCurrentInputFailure | null, liveSourceVersion = "v-current") {
  const translation = storedRow();
  const before = translation.localizationInputVersion;
  const result = classifyContentTranslationForReconciliation({
    translation,
    liveSourceVersion,
    originalFields,
    concepts: [concept],
    attemptedCurrentInputFailure: attempted,
  });
  assert.equal(translation.localizationInputVersion, before);
  return result;
}

describe("F.3.31C.1 terminology-only input staleness", () => {
  it("A. an attempted current input that failed only terminology is not work", () => {
    const result = classify(terminologyAttempt());
    assert.equal(result.presentationEligible, true);
    assert.equal(result.reconciliationState, "READY");
    assert.equal(result.workRemaining, false);
    assert.equal(result.localizedCoverage, true);
    assert.ok(
      result.terminologyQualityDiagnostics?.some(
        (item) => item.violationType === "missing_preferred",
      ),
    );
  });

  it("B. a new localization input that has not been attempted remains work", () => {
    const neverAttempted = classify(null);
    assert.equal(neverAttempted.reconciliationState, "STALE");
    assert.equal(neverAttempted.workRemaining, true);
    assert.ok(neverAttempted.reasons.includes("localization_input_stale"));

    const attemptedOlderInput = classify(
      terminologyAttempt({ localizationInputVersion: "stored-older-input" }),
    );
    assert.equal(attemptedOlderInput.reconciliationState, "STALE");
    assert.equal(attemptedOlderInput.workRemaining, true);
  });

  it("C. a structural failure of the current input remains work", () => {
    const result = classify(
      terminologyAttempt({ failureReasonCode: "MISSING_REQUIRED_PATH" }),
    );
    assert.equal(result.reconciliationState, "STALE");
    assert.equal(result.workRemaining, true);
    assert.ok(result.reasons.includes("localization_input_stale"));
  });

  it("D. a sourceVersion change remains work", () => {
    const result = classify(terminologyAttempt({ sourceVersion: "v-next" }), "v-next");
    assert.equal(result.reconciliationState, "STALE");
    assert.equal(result.workRemaining, true);
    assert.ok(result.reasons.includes("stale_identity"));
  });

  it("E. unchanged terminology retry suppression remains", () => {
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        liveSourceVersion: "v-current",
        failedSourceVersion: "v-current",
        liveLocalizationInputVersion: liveInputVersion(),
        failedLocalizationInputVersion: liveInputVersion(),
      }),
      "terminal",
    );
    const preflight = readFileSync(
      path.join(here, "../../../src/modules/language/public-localization-retry-preflight.ts"),
      "utf8",
    );
    assert.equal(preflight.includes('sameVersionRetryDecision === "terminal"'), true);
  });

  it("F. terminology exactness without an attempted current input stays diagnostic", () => {
    const result = classifyContentTranslationForReconciliation({
      translation: {
        ...storedRow(),
        localizationInputVersion: liveInputVersion(),
      },
      liveSourceVersion: "v-current",
      originalFields,
      concepts: [concept],
    });
    assert.equal(result.presentationEligible, true);
    assert.equal(result.workRemaining, false);
    assert.ok(
      result.terminologyQualityDiagnostics?.some(
        (item) => item.conceptId === "humanity_union" && item.violationType === "missing_preferred",
      ),
    );
  });

  it("G. the rule has no locale-specific branch", () => {
    const validity = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-validity.ts"),
      "utf8",
    );
    const start = validity.indexOf("export function isTerminologyOnlyAttemptOfCurrentInput");
    const body = validity.slice(start);
    assert.equal(body.includes('locale === "uk"'), false);
    assert.equal(body.includes('locale === "he"'), false);
    assert.equal(body.includes("initiative-analysis-1787086712348"), false);

    const mixed = classify(
      terminologyAttempt({
        localeFailures: [
          { targetLocale: "uk", failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION" },
          { targetLocale: "uk", failureReasonCode: "MISSING_REQUIRED_PATH" },
        ],
      }),
    );
    assert.equal(mixed.workRemaining, true);
  });
});
