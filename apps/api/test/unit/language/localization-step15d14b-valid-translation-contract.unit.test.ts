/**
 * STEP 15D.14.B — Gate B: valid translation / presentation-eligibility contract.
 * No provider calls. No durable writes. No locale-specific branches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TranslatedContentRecord } from "@hu/types";

import {
  classifyContentTranslationValidity,
  isPresentationEligibleTranslation,
} from "../../../src/modules/language/content-translation-validity.js";
import { resolveCanonicalResidualTranslationState } from "../../../src/modules/language/content-translation-residual-state-core.js";
import {
  accumulateLiveResidualCounts,
  applyLiveResidualBucket,
} from "../../../src/modules/language/live-residual-ct-coverage.js";
import { classifyLiveResidualIdentity } from "../../../src/modules/language/live-residual-identity.js";
import {
  resolveStructuredTranslatedDisplay,
  resolveTranslatedDisplay,
} from "../../../src/modules/language/resolve-translated-display.js";
import { resolveCanonicalRegistryLocale } from "../../../src/modules/language/language-registry/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";

const SOURCE_TITLE = 'Bridging the "New World Disorder"';
const SOURCE_VERSION = "V";

function baseRecord(
  overrides: Partial<TranslatedContentRecord> &
    Pick<TranslatedContentRecord, "targetLanguage" | "translatedContent" | "translationProvider">,
): TranslatedContentRecord {
  return {
    translationId: `t-${overrides.targetLanguage}`,
    sourceKind: "initiative",
    sourceRecordId: "initiative-prod-defect",
    sourceVersion: SOURCE_VERSION,
    sourceLanguage: "en",
    translationKind: "machine",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

function deterministicPlaceholder(targetLanguage: string): TranslatedContentRecord {
  return baseRecord({
    targetLanguage: targetLanguage as TranslatedContentRecord["targetLanguage"],
    translationProvider: "deterministic",
    translatedContent: {
      title: `[${targetLanguage}] ${SOURCE_TITLE}`,
    },
  });
}

function realMachineTranslation(
  targetLanguage: string,
  provider: "gemini" | "google_cloud" | "deepl",
): TranslatedContentRecord {
  return baseRecord({
    targetLanguage: targetLanguage as TranslatedContentRecord["targetLanguage"],
    translationProvider: provider,
    translatedContent: {
      title: `LOCALIZED(${targetLanguage}): ${SOURCE_TITLE}`,
    },
  });
}

describe("15D.14.B — valid translation contract", () => {
  it("deterministic CURRENT => INVALID (uk/ar/zh-Hant generic)", () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const row = deterministicPlaceholder(locale);
      const classification = classifyContentTranslationValidity({
        translation: row,
        liveSourceVersion: SOURCE_VERSION,
        originalFields: { title: SOURCE_TITLE },
      });
      assert.equal(classification.identityCurrent, true, locale);
      assert.equal(classification.presentationEligible, false, locale);
      assert.equal(classification.reconciliationState, "INVALID", locale);
      assert.equal(classification.localizedCoverage, false, locale);
      assert.equal(classification.workRemaining, true, locale);
      assert.equal(
        resolveCanonicalResidualTranslationState({
          translationRow: row,
          liveSourceVersion: SOURCE_VERSION,
          outboxDisposition: "none",
        }),
        "INVALID",
        locale,
      );
    }
  });

  it("deterministic INVALID is not preferred_translation (public resolve)", () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const row = deterministicPlaceholder(locale);
      const resolved = resolveTranslatedDisplay({
        originalContent: SOURCE_TITLE,
        originalLanguage: "en",
        preferredReadingLanguage: locale,
        translations: [row],
        translationPreference: "preferred",
      });
      assert.equal(resolved.presentationMode, "original", locale);
      assert.equal(resolved.content, SOURCE_TITLE, locale);
      assert.equal(isPresentationEligibleTranslation(row), false, locale);
    }
  });

  it("deterministic INVALID does not count as localized CURRENT coverage", () => {
    const bucket = accumulateLiveResidualCounts([
      classifyLiveResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        liveInvalid: true,
        preflightReady: false,
        readyState: "INVALID_PLACEHOLDER",
        terminalFailureForCurrentVersion: false,
      }),
    ]);
    assert.equal(bucket.current, 0);
    assert.equal(bucket.invalid, 1);
    assert.equal(bucket.workItemsRequired, 1);
  });

  it("real machine CURRENT => READY (gemini + non-Gemini)", () => {
    for (const provider of ["gemini", "google_cloud", "deepl"] as const) {
      const row = realMachineTranslation("uk", provider);
      const classification = classifyContentTranslationValidity({
        translation: row,
        liveSourceVersion: SOURCE_VERSION,
        originalFields: { title: SOURCE_TITLE },
      });
      assert.equal(classification.presentationEligible, true, provider);
      assert.equal(classification.reconciliationState, "READY", provider);
      assert.equal(classification.localizedCoverage, true, provider);
      assert.equal(classification.workRemaining, false, provider);
      assert.equal(
        resolveCanonicalResidualTranslationState({
          translationRow: row,
          liveSourceVersion: SOURCE_VERSION,
          outboxDisposition: "failed",
        }),
        "CURRENT",
        provider,
      );

      const resolved = resolveTranslatedDisplay({
        originalContent: SOURCE_TITLE,
        originalLanguage: "en",
        preferredReadingLanguage: "uk",
        translations: [row],
        translationPreference: "preferred",
      });
      assert.equal(resolved.presentationMode, "preferred_translation", provider);
    }
  });

  it("human/author-approved provenance => READY", () => {
    const row = baseRecord({
      targetLanguage: "uk",
      translationProvider: "human_import",
      translationKind: "human",
      translatedContent: { title: "Місток через «новий світовий безлад»" },
    });
    const classification = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: SOURCE_VERSION,
      originalFields: { title: SOURCE_TITLE },
    });
    assert.equal(classification.reconciliationState, "READY");
    assert.equal(classification.presentationEligible, true);
  });

  it("MISSING when no artifact", () => {
    const classification = classifyContentTranslationValidity({
      translation: null,
      liveSourceVersion: SOURCE_VERSION,
    });
    assert.equal(classification.reconciliationState, "MISSING");
    assert.equal(classification.identityCurrent, false);
    assert.equal(classification.workRemaining, true);
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: null,
        liveSourceVersion: SOURCE_VERSION,
        outboxDisposition: "none",
      }),
      "MISSING",
    );
  });

  it("STALE when sourceVersion differs", () => {
    const row = realMachineTranslation("uk", "gemini");
    const classification = classifyContentTranslationValidity({
      translation: { ...row, sourceVersion: "V-old" },
      liveSourceVersion: SOURCE_VERSION,
    });
    assert.equal(classification.reconciliationState, "STALE");
    assert.equal(classification.presentationEligible, false);
    assert.equal(classification.identityCurrent, false);
  });

  it("structurally incomplete CURRENT is not READY", () => {
    const row = baseRecord({
      targetLanguage: "uk",
      translationProvider: "gemini",
      translatedContent: { title: "Лише заголовок" },
    });
    const classification = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: SOURCE_VERSION,
      originalFields: {
        title: SOURCE_TITLE,
        summary: "A non-empty summary that must be localized.",
      },
    });
    assert.equal(classification.identityCurrent, true);
    assert.equal(classification.structurallyComplete, false);
    assert.equal(classification.presentationEligible, false);
    assert.notEqual(classification.reconciliationState, "READY");

    const resolved = resolveStructuredTranslatedDisplay({
      originalFields: {
        title: SOURCE_TITLE,
        summary: "A non-empty summary that must be localized.",
      },
      originalLanguage: "en",
      preferredReadingLanguage: "uk",
      translations: [row],
      translationPreference: "preferred",
    });
    assert.equal(resolved.presentationMode, "original");
  });

  it("legacy residual freshness-only callers still resolve CURRENT", () => {
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: { freshness: "current", stale: false },
        liveSourceVersion: "v1",
        outboxDisposition: "failed",
      }),
      "CURRENT",
    );
  });

  it("live residual INVALID contributes to work remaining, not current", () => {
    const mutable = {
      current: 0,
      missing: 0,
      stale: 0,
      invalid: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: 0,
    };
    applyLiveResidualBucket(mutable, "RETRY_READY_INVALID");
    assert.equal(mutable.invalid, 1);
    assert.equal(mutable.current, 0);
    assert.equal(mutable.workItemsRequired, 1);
  });

  it("Gate A regression: zh-hant resolves to Registry canonical zh-Hant", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
      const row = deterministicPlaceholder("zh-Hant");
      const fromIdentityKeyPreferred = resolveTranslatedDisplay({
        originalContent: SOURCE_TITLE,
        originalLanguage: "en",
        preferredReadingLanguage: "zh-hant",
        translations: [row],
        translationPreference: "preferred",
      });
      assert.equal(fromIdentityKeyPreferred.presentationMode, "original");
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }
  });
});
