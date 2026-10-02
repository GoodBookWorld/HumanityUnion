/**
 * F.3.31B — exact terminology is a CT quality diagnostic.
 * Missing, stale, and structural invalidity remain work.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  type LanguageLocalizationReadinessReport,
  type TerminologyConcept,
  type TranslatedContentRecord,
} from "@hu/types";

import { decideSameVersionWarmFailureRetry } from "../../../src/modules/language/content-translation-failure-metadata.js";
import { classifyContentTranslationForReconciliation } from "../../../src/modules/language/content-translation-validity.js";
import {
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { accumulateLiveResidualCounts } from "../../../src/modules/language/live-residual-ct-coverage.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const concept: TerminologyConcept = {
  conceptId: "humanity_union",
  canonicalEnglishTerm: "Humanity Union",
  category: "brand",
  status: "published",
  translations: {
    uk: { preferredTerm: "Союз Людства", aliases: [] },
    ar: { preferredTerm: "اتحاد الإنسانية", aliases: [] },
    ka: { preferredTerm: "ადამიანობის კავშირი", aliases: [] },
    he: { preferredTerm: "איחוד האנושות", aliases: [] },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function row(
  targetLanguage: string,
  translatedContent: Record<string, string>,
  overrides: Partial<TranslatedContentRecord> = {},
): TranslatedContentRecord {
  return {
    translationId: `t-${targetLanguage}`,
    sourceKind: "initiative",
    sourceRecordId: "initiative-f331b",
    sourceVersion: "v-current",
    sourceLanguage: "en",
    targetLanguage: targetLanguage as TranslatedContentRecord["targetLanguage"],
    translatedContent,
    translationProvider: "gemini",
    translationKind: "machine",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

const originalFields = {
  title: "Development of the Humanity Union platform",
  description: "Neighbors restore a river.",
};

function classify(targetLanguage: string, translatedContent: Record<string, string>, overrides: Partial<TranslatedContentRecord> = {}) {
  return classifyContentTranslationForReconciliation({
    translation: row(targetLanguage, translatedContent, overrides),
    liveSourceVersion: overrides.sourceVersion ?? "v-current",
    originalFields,
    concepts: [concept],
  });
}

describe("F.3.31B CT presentation readiness", () => {
  it("A. preferred-term exactness failure is presentation-eligible with no work", () => {
    const result = classify("uk", {
      title: "Розвиток платформи спільноти",
      description: "Сусідська робота",
    });
    assert.equal(result.presentationEligible, true);
    assert.equal(result.reconciliationState, "READY");
    assert.equal(result.workRemaining, false);
    assert.equal(result.localizedCoverage, true);
    assert.ok(
      result.terminologyQualityDiagnostics?.some(
        (item) => item.conceptId === "humanity_union" && item.violationType === "missing_preferred",
      ),
    );
  });

  it("B. residual canonical terminology is presentation-eligible with no work", () => {
    const result = classify("ar", {
      title: "تطوير منصة اتحاد الإنسانية Humanity Union",
      description: "عمل جماعي",
    });
    assert.equal(result.presentationEligible, true);
    assert.equal(result.workRemaining, false);
    assert.ok(
      result.terminologyQualityDiagnostics?.some(
        (item) => item.violationType === "residual_canonical",
      ),
    );
  });

  it("C. a missing translation remains work", () => {
    const result = classifyContentTranslationForReconciliation({
      translation: null,
      liveSourceVersion: "v-current",
      originalFields,
      concepts: [concept],
    });
    assert.equal(result.reconciliationState, "MISSING");
    assert.equal(result.workRemaining, true);
    assert.equal(result.presentationEligible, false);
  });

  it("D. a source-version change remains work", () => {
    const result = classifyContentTranslationForReconciliation({
      translation: row("ka", {
        title: "პლატფორმის განვითარება",
        description: "საზოგადოებრივი სამუშაო",
      }),
      liveSourceVersion: "v-next",
      originalFields,
      concepts: [concept],
    });
    assert.equal(result.reconciliationState, "STALE");
    assert.equal(result.workRemaining, true);
    assert.ok(result.reasons.includes("stale_identity"));
  });

  it("E. a localization-input change remains work", () => {
    const result = classify("he", {
      title: "פיתוח הפלטפורמה",
      description: "עבודה קהילתית",
    }, { localizationInputVersion: "input-previous" });
    assert.equal(result.reconciliationState, "STALE");
    assert.equal(result.workRemaining, true);
    assert.ok(result.reasons.includes("localization_input_stale"));
  });

  it("F. structural and untranslated presentation failures remain work", () => {
    const placeholder = classifyContentTranslationForReconciliation({
      translation: row("uk", {
        title: "[uk] Development of the Humanity Union platform",
        description: "[uk] Neighbors restore a river.",
      }, { translationProvider: "deterministic" }),
      liveSourceVersion: "v-current",
      originalFields,
      concepts: [concept],
    });
    assert.equal(placeholder.reconciliationState, "INVALID");
    assert.equal(placeholder.workRemaining, true);

    const incomplete = classify("uk", { title: "Лише заголовок" });
    assert.equal(incomplete.workRemaining, true);
    assert.equal(incomplete.presentationEligible, false);

    const untranslated = classify("uk", {
      title: originalFields.title,
      description: originalFields.description,
    });
    assert.equal(untranslated.reconciliationState, "INVALID");
    assert.equal(untranslated.workRemaining, true);
    assert.ok(untranslated.reasons.includes("untranslated_source_equivalent"));
    assert.equal(untranslated.terminologyQualityDiagnostics, undefined);
  });

  it("G/H. terminology quality does not hold activation, and real work blocks READY", () => {
    const quality = classify("uk", {
      title: "Розвиток платформи спільноти",
      description: "Сусідська робота",
    });
    assert.equal(quality.workRemaining, false);
    const qualityCounts = accumulateLiveResidualCounts(["CURRENT"]);
    const readyState = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      participantWebUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: qualityCounts,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(readyState, "READY");

    const domains = emptyPendingDomains();
    const ownersReady = {
      ...domains,
      brand: { ...domains.brand, status: "ready" as const },
      terminology: { ...domains.terminology, status: "ready" as const },
      webUi: {
        ...domains.webUi,
        status: "ready" as const,
        dataReady: true,
        preparationPhase: "ready" as const,
      },
    };
    const readyReport = {
      engineReady: true,
      languageDataReady: true,
      state: readyState,
      ct: qualityCounts,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    } as LanguageLocalizationReadinessReport;
    assert.equal(
      deriveActivationJobStatus({
        readiness: readyReport,
        domains: ownersReady,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
      }),
      "completed",
    );

    const openCounts = accumulateLiveResidualCounts(["CURRENT", "RETRY_READY_MISSING"]);
    const openState = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      participantWebUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: openCounts,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(openState, "BACKFILL_REQUIRED");
    assert.equal(
      deriveActivationJobStatus({
        readiness: { ...readyReport, state: openState, ct: openCounts },
        domains: ownersReady,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
      }),
      "running",
    );

    const admin = readFileSync(
      path.join(
        here,
        "../../../../web/src/features/administration/admin-languages-localization-progress.ts",
      ),
      "utf8",
    );
    assert.match(admin, /readinessState === "READY" \? 100/);
  });

  it("I/J. unchanged terminology failures stay non-retryable and the contract has no locale branch", () => {
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        liveSourceVersion: "v-current",
        failedSourceVersion: "v-current",
        liveLocalizationInputVersion: "input-current",
        failedLocalizationInputVersion: "input-current",
      }),
      "terminal",
    );
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        liveSourceVersion: "v-next",
        failedSourceVersion: "v-current",
        liveLocalizationInputVersion: "input-current",
        failedLocalizationInputVersion: "input-current",
      }),
      "retryable",
    );

    const validity = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-validity.ts"),
      "utf8",
    );
    const start = validity.indexOf("export function classifyContentTranslationForReconciliation");
    const body = validity.slice(start);
    assert.equal(body.includes('locale === "uk"'), false);
    assert.equal(body.includes('locale === "he"'), false);
    assert.equal(body.includes("terminologyProtectionFailed"), false);

    const preflight = readFileSync(
      path.join(here, "../../../src/modules/language/public-localization-retry-preflight.ts"),
      "utf8",
    );
    assert.equal(
      preflight.includes('sameVersionRetryDecision === "terminal"'),
      true,
    );
  });
});
