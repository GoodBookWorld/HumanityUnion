/**
 * STEP 15D.14.F.3.19 — Gate C residual forward progress.
 * Deterministic. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationSourceOriginalEntityType,
} from "@hu/types";
import type { LanguageActivationWebUiDomainProgress, TerminologyConcept, TranslatedContentRecord } from "@hu/types";

import { isActivationProviderTransientError } from "../../../src/modules/language/activation-provider-transient-recovery.js";
import {
  ContentTranslationValidationError,
  SEMANTIC_RESIDUAL_DEFER_BASE_MS,
  SEMANTIC_RESIDUAL_DEFER_MAX_MS,
  encodeContentTranslationFailureMetadata,
  isSemanticResidualDeferActive,
  parseContentTranslationFailureMetadata,
  semanticResidualDeferDelayMs,
  semanticResidualRetryEligibleAtIso,
  shouldDeferResidualSelection,
  type ContentTranslationSafeFailureMetadata,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import { classifyContentTranslationWarmFailure } from "../../../src/modules/language/content-translation-warm-failure.js";
import { classifyContentTranslationForReconciliation } from "../../../src/modules/language/content-translation-validity.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { accumulateLiveResidualCounts } from "../../../src/modules/language/live-residual-ct-coverage.js";
import { classifyLiveResidualIdentity } from "../../../src/modules/language/live-residual-identity.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import {
  selectReadyPresentationsForResidualRetry,
  type PublicLocalizationResidualWithPreflight,
  type PublicLocalizationRetrySelection,
} from "../../../src/modules/language/public-localization-retry-preflight.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  isImmediateTerminalOutboxFailure,
  resolveOutboxFailureStatus,
} from "../../../src/infrastructure/outbox/outbox.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse("2026-09-28T12:00:00.000Z");
const SOURCE_VERSION = "v-592dcc389c231bb7";
const INPUT_VERSION = "liv-uk-1";

function concept(): TerminologyConcept {
  return {
    conceptId: "humanity_union",
    canonicalEnglishTerm: "Humanity Union",
    category: "brand",
    status: "published",
    translations: {
      uk: { preferredTerm: "Союз Людства", aliases: [] },
      ka: { preferredTerm: "ადამიანობის კავშირი", aliases: [] },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function storedInvalid(targetLanguage: "uk" | "ka"): TranslatedContentRecord {
  return {
    translationId: "t-invalid",
    sourceKind: "initiative",
    sourceRecordId: "initiative-1784349613932",
    sourceVersion: SOURCE_VERSION,
    sourceLanguage: "en",
    targetLanguage,
    translatedContent: {
      title: "Розвиток платформи спільноти",
      description: "опис роботи",
    },
    translationProvider: "gemini",
    translationKind: "machine",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    stale: false,
    freshness: "current",
  };
}

function failureMeta(overrides: Partial<ContentTranslationSafeFailureMetadata> = {}): ContentTranslationSafeFailureMetadata {
  return {
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
    sourceKind: "initiative",
    sourceRecordId: "initiative-1784349613932",
    sourceVersion: SOURCE_VERSION,
    targetLocale: "uk",
    failedAt: "2026-09-28T12:00:00.000Z",
    retryabilityHint: "deferred_semantic_retry",
    retryEligibleAt: semanticResidualRetryEligibleAtIso({ failedAtMs: NOW, streak: 1 }),
    localizationInputVersion: INPUT_VERSION,
    ...overrides,
  };
}

function residual(input: {
  sourceKind: string;
  sourceRecordId: string;
  invalid?: boolean;
  stale?: boolean;
  deferred?: boolean;
}): PublicLocalizationResidualWithPreflight {
  return {
    family: input.sourceKind,
    presentationIdentity: {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
    },
    targetLocale: "ka",
    translationState: input.invalid ? "INVALID" : input.stale ? "STALE" : "MISSING",
    sourceVersionMatch: "match",
    failureClass: input.invalid ? "VALIDATION_FAILED" : null,
    failureReasonCode: input.invalid ? "TERMINOLOGY_PROTECTION_VIOLATION" : null,
    retryability: input.deferred ? "deferred_semantic_retry" : null,
    lastFailureAt: input.deferred ? "2026-09-28T12:00:00.000Z" : null,
    outboxDisposition: input.deferred ? "failed" : "none",
    mayScheduleNewWarm: true,
    latestAttemptAt: null,
    latestAttemptReason: null,
    latestAttemptTargetLocale: null,
    failureMetadataVersion: null,
    retryPreflight: {
      sourceResolvable: true,
      presentationValid: true,
      localeEligible: true,
      currentTranslationAbsent: true,
      terminalFailureForCurrentVersion: false,
      activeWorkAbsent: true,
      architectureRetryBasis: null,
      failureReasonCode: input.invalid ? "TERMINOLOGY_PROTECTION_VIOLATION" : null,
      ready: true,
      readyState: input.invalid ? "INVALID_PLACEHOLDER" : "MISSING_READY_FOR_WARM",
      blockReason: null,
      liveTranslationInvalid: input.invalid === true,
      liveTranslationStale: input.stale === true,
      semanticRetryDeferred: input.deferred === true,
      semanticRetryEligibleAt: input.deferred
        ? semanticResidualRetryEligibleAtIso({ failedAtMs: NOW, streak: 1 })
        : null,
    },
  };
}

function selection(rows: readonly PublicLocalizationResidualWithPreflight[]): PublicLocalizationRetrySelection {
  return {
    RETRY_READY_IDENTITIES: rows.length,
    RETRY_BLOCKED_IDENTITIES: 0,
    ready: rows,
    blocked: [],
    byFamilyReady: {},
    byLocaleReady: {},
  };
}

const MISSING_KINDS = [
  "initiative_revision",
  "implementation_commitment",
  "implementation_tracking",
  "decision_session",
  "civic_media",
  "initiative",
  "petition",
  "blog_post",
  "official_response",
  "public_impact",
  "civic_archive",
  "collective_decision",
] as const;

describe("F.3.19 residual forward progress", () => {
  it("1. terminology exactness on localized prose is diagnostic, not INVALID work", () => {
    const before = classifyContentTranslationForReconciliation({
      translation: storedInvalid("uk"),
      liveSourceVersion: SOURCE_VERSION,
      originalFields: {
        title: "Development of the Humanity Union platform",
        description: "desc",
      },
      concepts: [concept()],
    });
    assert.equal(before.reconciliationState, "READY");
    assert.equal(before.presentationEligible, true);
    assert.equal(before.workRemaining, false);
    assert.ok(
      before.terminologyQualityDiagnostics?.some(
        (item) => item.conceptId === "humanity_union" && item.violationType === "missing_preferred",
      ),
    );

    const service = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    const terminology = service.indexOf("assessRequiredTerminologyProtection({");
    const upsert = service.indexOf("await upsertContentTranslation(record)");
    assert.ok(terminology > 0 && upsert > terminology);
    assert.equal(service.includes("TERMINOLOGY_PROTECTION_VIOLATION"), false);

    const after = classifyContentTranslationForReconciliation({
      translation: storedInvalid("ka"),
      liveSourceVersion: SOURCE_VERSION,
      originalFields: {
        title: "Development of the Humanity Union platform",
        description: "desc",
      },
      concepts: [concept()],
    });
    assert.equal(after.reconciliationState, "READY");
    assert.equal(after.workRemaining, false);
  });

  it("2. a semantic failure is durably deferred and terminal on the first outbox attempt", () => {
    const encoded = encodeContentTranslationFailureMetadata(failureMeta());
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.equal(parsed?.sourceKind, "initiative");
    assert.equal(parsed?.sourceRecordId, "initiative-1784349613932");
    assert.equal(parsed?.targetLocale, "uk");
    assert.equal(parsed?.sourceVersion, SOURCE_VERSION);
    assert.equal(parsed?.localizationInputVersion, INPUT_VERSION);
    assert.equal(parsed?.failureReasonCode, "TERMINOLOGY_PROTECTION_VIOLATION");
    assert.equal(parsed?.retryabilityHint, "deferred_semantic_retry");
    assert.ok(parsed?.retryEligibleAt);

    const error = new TranslationProviderError("bad_request", encoded);
    (error as Error & { immediateTerminalOutboxFailure?: boolean }).immediateTerminalOutboxFailure =
      true;
    assert.equal(isImmediateTerminalOutboxFailure(error), true);
    assert.equal(
      resolveOutboxFailureStatus({ attempts: 1, maxAttempts: 5, immediateTerminal: true }),
      "failed",
    );
    assert.equal(
      resolveOutboxFailureStatus({ attempts: 1, maxAttempts: 5, immediateTerminal: false }),
      "pending",
    );
  });

  it("3-5. deferred invalids yield to the next invalid and then to missing", () => {
    const invalids = Array.from({ length: 7 }, (_, index) =>
      residual({
        sourceKind: "collaborative_analysis",
        sourceRecordId: `analysis-${index}`,
        invalid: true,
        deferred: index !== 1,
      }),
    );
    invalids[0] = residual({
      sourceKind: "initiative",
      sourceRecordId: "initiative-1784349613932",
      invalid: true,
      deferred: true,
    });
    const missing = MISSING_KINDS.map((sourceKind, index) =>
      residual({
        sourceKind,
        sourceRecordId: `${sourceKind}-${index}`,
      }),
    );
    const eligible = selectCurrentlyRetryEligibleResiduals([...invalids, ...missing]);
    assert.equal(eligible[0]?.presentationIdentity.sourceRecordId, "analysis-1");
    assert.equal(eligible.filter((row) => row.retryPreflight.liveTranslationInvalid).length, 1);
    assert.equal(eligible.length, 13);

    const allDeferred = selectCurrentlyRetryEligibleResiduals(
      invalids.map((row) =>
        residual({
          sourceKind: row.presentationIdentity.sourceKind,
          sourceRecordId: row.presentationIdentity.sourceRecordId,
          invalid: true,
          deferred: true,
        }),
      ).concat(missing),
    );
    assert.equal(allDeferred.length, 12);
    assert.equal(
      allDeferred.every((row) => row.retryPreflight.liveTranslationInvalid !== true),
      true,
    );
    assert.deepEqual(
      allDeferred.map((row) => row.presentationIdentity.sourceKind),
      [...MISSING_KINDS].sort((a, b) => a.localeCompare(b)),
    );

    const schedule = selectReadyPresentationsForResidualRetry(selection(eligible));
    assert.equal(schedule[0]?.sourceRecordId, "analysis-1");
    assert.equal(
      schedule.some((row) => row.sourceRecordId === "initiative-1784349613932"),
      false,
    );
    const priorityPreserved = selectReadyPresentationsForResidualRetry(
      selection([
        residual({
          sourceKind: "improvement_proposal",
          sourceRecordId: "proposal-b",
          invalid: true,
        }),
        residual({
          sourceKind: "initiative",
          sourceRecordId: "initiative-missing-a",
        }),
      ]),
    );
    assert.deepEqual(
      priorityPreserved.map((row) => row.sourceRecordId),
      ["proposal-b", "initiative-missing-a"],
    );
  });

  it("6-7. a deferred invalid still counts as work and cannot become READY", () => {
    const classifications = [
      ...Array.from({ length: 7 }, () =>
        classifyLiveResidualIdentity({
          liveCurrent: false,
          liveStale: false,
          liveInvalid: true,
          preflightReady: true,
          readyState: "INVALID_PLACEHOLDER",
          terminalFailureForCurrentVersion: true,
        }),
      ),
      ...Array.from({ length: 12 }, () =>
        classifyLiveResidualIdentity({
          liveCurrent: false,
          liveStale: false,
          liveInvalid: false,
          preflightReady: true,
          readyState: "MISSING_READY_FOR_WARM",
          terminalFailureForCurrentVersion: false,
        }),
      ),
    ];
    const counts = accumulateLiveResidualCounts(classifications);
    assert.equal(counts.invalid, 7);
    assert.equal(counts.missing, 12);
    assert.equal(counts.workItemsRequired, 19);

    const state = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      participantWebUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: { ...emptyLanguageLocalizationCountBucket(), ...counts },
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(state, "BACKFILL_REQUIRED");
    assert.notEqual(state, "READY");
  });

  it("8-10. restart, version change, and a successful replacement", () => {
    const encoded = encodeContentTranslationFailureMetadata(failureMeta());
    const restored = parseContentTranslationFailureMetadata(encoded);
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: restored,
        liveSourceVersion: SOURCE_VERSION,
        liveLocalizationInputVersion: INPUT_VERSION,
        nowMs: NOW + 60_000,
      }),
      true,
    );
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: restored,
        liveSourceVersion: "v-next",
        liveLocalizationInputVersion: INPUT_VERSION,
        nowMs: NOW + 60_000,
      }),
      false,
    );
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: restored,
        liveSourceVersion: SOURCE_VERSION,
        liveLocalizationInputVersion: "liv-uk-2",
        nowMs: NOW + 60_000,
      }),
      false,
    );
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: restored,
        liveSourceVersion: SOURCE_VERSION,
        liveLocalizationInputVersion: INPUT_VERSION,
        nowMs: NOW + SEMANTIC_RESIDUAL_DEFER_BASE_MS + 1,
      }),
      false,
    );
    assert.equal(
      shouldDeferResidualSelection({
        ready: false,
        metadata: restored,
        liveSourceVersion: SOURCE_VERSION,
        liveLocalizationInputVersion: INPUT_VERSION,
        nowMs: NOW + 60_000,
      }),
      false,
    );
    assert.equal(semanticResidualDeferDelayMs(1), SEMANTIC_RESIDUAL_DEFER_BASE_MS);
    assert.equal(semanticResidualDeferDelayMs(2), SEMANTIC_RESIDUAL_DEFER_BASE_MS * 2);
    assert.equal(semanticResidualDeferDelayMs(8), SEMANTIC_RESIDUAL_DEFER_MAX_MS);
    assert.equal(semanticResidualDeferDelayMs(20), SEMANTIC_RESIDUAL_DEFER_MAX_MS);
  });

  it("11-12. semantic rejection does not arm Gate E, and provider starts stay paced", () => {
    const terminology = new ContentTranslationValidationError(
      "TERMINOLOGY_PROTECTION_VIOLATION",
      "Required terminology was not honored.",
      "malformed_response",
      INPUT_VERSION,
    );
    assert.equal(classifyContentTranslationWarmFailure(terminology), "non_retryable");
    assert.equal(isActivationProviderTransientError(terminology), false);
    const semantic = new TranslationProviderError(
      "bad_request",
      encodeContentTranslationFailureMetadata(failureMeta()),
    );
    assert.equal(isActivationProviderTransientError(semantic), false);
    assert.equal(
      isActivationProviderTransientError(new TranslationProviderError("unavailable", "provider down")),
      true,
    );

    const service = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    const paced = service.indexOf("await runLocalizationProviderRequest");
    const terminologyAssess = service.indexOf("assessRequiredTerminologyProtection({");
    assert.ok(paced > 0 && terminologyAssess > paced);
  });

  it("13. Gate 15D.9.1 still refuses CT enqueue when WEB_UI is not READY", () => {
    const webUi: LanguageActivationWebUiDomainProgress = {
      status: "running",
      dataReady: false,
      missingKeyCount: 4,
      emptyKeyCount: 0,
      requiredKeyCount: 10,
      effectiveSource: "remote",
      detail: "not ready",
      preparationPhase: "translating",
      checkpointId: "cp-zh",
      sourceHash: "hash",
      totalBatches: 1,
      completedBatches: 0,
      totalLeaves: 10,
      completedLeaves: 6,
      providerFailure: false,
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
    };
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });

  it("14. public_news stays outside CT", () => {
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    assert.equal(
      (LANGUAGE_ACTIVATION_CT_OWNED_KINDS as readonly string[]).includes("public_news"),
      false,
    );
    for (const kind of [
      "initiative_revision",
      "implementation_commitment",
      "implementation_tracking",
      "decision_session",
      "civic_media",
    ]) {
      assert.equal(
        (LANGUAGE_ACTIVATION_CT_OWNED_KINDS as readonly string[]).includes(kind),
        true,
      );
    }
  });
});
