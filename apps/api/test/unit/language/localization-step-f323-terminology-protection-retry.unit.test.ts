/**
 * STEP 15D.14.F.3.23 — same-version terminology-protection failures use the
 * existing semantic defer. Deterministic. No Gemini HTTP.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";

import type { Initiative, LanguageActivationWebUiDomainProgress } from "@hu/types";
import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
} from "@hu/types";

import {
  isImmediateTerminalOutboxFailure,
  outboxPacingDeferAvailableAt,
} from "../../../src/infrastructure/outbox/outbox.repository.js";
import { isActivationProviderTransientError } from "../../../src/modules/language/activation-provider-transient-recovery.js";
import {
  SEMANTIC_RESIDUAL_DEFER_BASE_MS,
  SEMANTIC_RESIDUAL_DEFER_MAX_MS,
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  WARM_SAME_VERSION_TERMINAL_VALIDATION_REASONS,
  decideSameVersionWarmFailureRetry,
  encodeContentTranslationFailureMetadata,
  isSemanticResidualDeferActive,
  parseContentTranslationFailureMetadata,
  semanticResidualDeferDelayMs,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import { classifyContentTranslationValidity } from "../../../src/modules/language/content-translation-validity.js";
import { readContentTranslationWarmMemoryRecordForTests } from "../../../src/modules/language/content-translation-warm-enqueue.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { accumulateLiveResidualCounts } from "../../../src/modules/language/live-residual-ct-coverage.js";
import { classifyLiveResidualIdentity } from "../../../src/modules/language/live-residual-identity.js";
import {
  LocalizationProviderPacingDeferredError,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  getThinGeminiCooldownSnapshot,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  listLanguageRegistry,
  loadTranslatableSource,
  markContentTranslationWarmMemoryFailedForTests,
  processContentTranslationWarmMemoryQueueForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  selectReadyPresentationsForResidualRetry,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
  type PublicLocalizationResidualWithPreflight,
  type PublicLocalizationRetryPreflight,
} from "../../../src/modules/language/index.js";
import { resetContentTranslationWorkerConcurrencyForTests } from "../../../src/modules/language/content-translation-worker-concurrency.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";
import { upsertTerminologyGlossaryMemory } from "../../../src/modules/language/terminology-glossary/terminology-glossary.memory.store.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function initiative(suffix: string, title: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-f323-${suffix}`,
    stewardId: "member-f323",
    createdAt: now,
    updatedAt: now,
    title,
    description: "Neighbors will restore a local river.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function failureMessage(input: {
  sourceKind: string;
  sourceRecordId: string;
  sourceVersion: string;
  reason: string;
  hint: string;
  retryEligibleAt?: string;
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: input.reason,
    sourceKind: input.sourceKind as "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: "uk",
    failedAt: "2026-09-30T18:00:00.000Z",
    retryabilityHint: input.hint,
    ...(input.retryEligibleAt ? { retryEligibleAt: input.retryEligibleAt } : {}),
  });
}

async function preflightFor(sourceRecordId: string, sourceVersion: string) {
  return buildPublicLocalizationRetryPreflight({
    workItem: {
      sourceKind: "initiative",
      sourceRecordId,
      sourceVersion,
      targetLanguage: "uk",
      state: "MISSING",
      autoNodeCount: 1,
      missingOrStaleNodeCount: 1,
      fallbackPaths: ["title"],
    },
  });
}

function residualFrom(
  sourceKind: string,
  sourceRecordId: string,
  preflight: PublicLocalizationRetryPreflight,
): PublicLocalizationResidualWithPreflight {
  return {
    family: sourceKind,
    presentationIdentity: { sourceKind, sourceRecordId },
    targetLocale: "uk",
    translationState: "MISSING",
    sourceVersionMatch: "match",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: preflight.failureReasonCode,
    retryability: null,
    lastFailureAt: null,
    outboxDisposition: "failed",
    mayScheduleNewWarm: true,
    latestAttemptAt: null,
    latestAttemptReason: null,
    latestAttemptTargetLocale: null,
    failureMetadataVersion: null,
    retryPreflight: preflight,
  };
}

function deferredResidual(input: {
  sourceKind: string;
  sourceRecordId: string;
  retryEligibleAt: string;
}): PublicLocalizationResidualWithPreflight {
  const row = residualFrom(input.sourceKind, input.sourceRecordId, {
    sourceResolvable: true,
    presentationValid: true,
    localeEligible: true,
    currentTranslationAbsent: true,
    terminalFailureForCurrentVersion: false,
    activeWorkAbsent: true,
    architectureRetryBasis: "VALIDATION_DIAGNOSTICS_CONTRACT_v1",
    failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
    ready: true,
    readyState: "MISSING_READY_FOR_WARM",
    blockReason: null,
    liveTranslationInvalid: false,
    liveTranslationStale: false,
    semanticRetryDeferred: true,
    semanticRetryEligibleAt: input.retryEligibleAt,
  });
  return row;
}

describe("F.3.23 terminology protection uses the existing semantic defer", () => {
  const created: string[] = [];
  let providerCalls = 0;
  let providerMode: "violate" | "valid" = "violate";

  beforeEach(async () => {
    providerCalls = 0;
    providerMode = "violate";
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    resetThinGeminiProviderStateForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    setThinGeminiProviderStateForceMemoryForTests(true);
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    const provider: TranslationProvider = {
      providerId: "gemini",
      async translate(request) {
        providerCalls += 1;
        const source = JSON.parse(request.text) as Record<string, string>;
        const translated = Object.fromEntries(
          Object.entries(source).map(([key, value]) => {
            if (providerMode === "violate") {
              return [key, `Теплий ${key} ${value}`];
            }
            const replaced = String(value).replaceAll("Humanity Union", "Союз Людства");
            return [key, `Переклад ${replaced}`];
          }),
        );
        return {
          translatedText: JSON.stringify(translated),
          providerId: "gemini",
          isPlaceholder: false,
        };
      },
    };
    setTranslationProviderForTests(provider);
    await ensureLanguageRegistrySeeded();
    for (const row of await listLanguageRegistry()) {
      await updateLanguageRegistryRecord(row.languageId, {
        enabled: row.locale === "en" || row.locale === "uk",
        contentTranslationEnabled: row.locale === "uk",
        searchEnabled: false,
      });
    }
    upsertTerminologyGlossaryMemory({
      conceptId: "humanity_union",
      canonicalEnglishTerm: "Humanity Union",
      category: "brand",
      status: "published",
      translations: {
        uk: { preferredTerm: "Союз Людства", aliases: [] },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedByParticipantId: null,
    });
  });

  afterEach(() => {
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLocalizationProviderClockForTests(null);
    setThinGeminiProviderStateForceMemoryForTests(false);
    resetThinGeminiProviderStateForTests();
    resetTranslationProviderForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    for (const id of created.splice(0)) {
      deleteInitiative(id);
    }
  });

  it("keeps an unchanged terminology failure terminal and other validation terminal", () => {
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
        retryabilityHint: "non_retryable_until_code_or_content_change",
        liveSourceVersion: "v-current",
        failedSourceVersion: "v-current",
        liveLocalizationInputVersion: "input-a",
        failedLocalizationInputVersion: "input-a",
      }),
      "terminal",
    );
    for (const sourceKind of [
      "improvement_proposal",
      "blog_post",
      "petition",
      "civic_media",
    ] as const) {
      const parsed = parseContentTranslationFailureMetadata(
        encodeContentTranslationFailureMetadata({
          schema: "content_translation_failure_meta_v1",
          validationContractVersion: "v1",
          failureClass: "VALIDATION_FAILED",
          failureReasonCode: "TERMINOLOGY_PROTECTION_VIOLATION",
          sourceKind,
          sourceRecordId: `${sourceKind}-f323`,
          sourceVersion: "v-current",
          targetLocale: "uk",
          failedAt: "2026-09-30T18:00:00.000Z",
          retryabilityHint: "non_retryable_until_code_or_content_change",
        }),
      );
      assert.equal(
        decideSameVersionWarmFailureRetry({
          failureClass: parsed?.failureClass ?? null,
          failureReasonCode: parsed?.failureReasonCode ?? null,
          retryabilityHint: parsed?.retryabilityHint ?? null,
          liveSourceVersion: parsed?.sourceVersion,
          failedSourceVersion: parsed?.sourceVersion,
          liveLocalizationInputVersion: parsed?.localizationInputVersion,
          failedLocalizationInputVersion: parsed?.localizationInputVersion,
        }),
        "terminal",
      );
    }
    for (const reason of WARM_SAME_VERSION_TERMINAL_VALIDATION_REASONS) {
      assert.equal(
        decideSameVersionWarmFailureRetry({
          failureClass: "VALIDATION_FAILED",
          failureReasonCode: reason,
          retryabilityHint: "retryable",
        }),
        "terminal",
      );
    }
    assert.equal(
      (WARM_SAME_VERSION_TERMINAL_VALIDATION_REASONS as readonly string[]).includes(
        "TERMINOLOGY_PROTECTION_VIOLATION",
      ),
      false,
    );
    assert.equal(semanticResidualDeferDelayMs(1), SEMANTIC_RESIDUAL_DEFER_BASE_MS);
    assert.equal(semanticResidualDeferDelayMs(1), 10 * 60 * 1000);
    assert.equal(semanticResidualDeferDelayMs(2), 20 * 60 * 1000);
    assert.equal(semanticResidualDeferDelayMs(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP), SEMANTIC_RESIDUAL_DEFER_MAX_MS);
    assert.equal(semanticResidualDeferDelayMs(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP + 4), SEMANTIC_RESIDUAL_DEFER_MAX_MS);

    const decisionSrc = readFileSync(
      path.join(here, "../../../src/modules/language/content-translation-failure-metadata.ts"),
      "utf8",
    );
    const decisionStart = decisionSrc.indexOf("export function decideSameVersionWarmFailureRetry");
    const decisionEnd = decisionSrc.indexOf("export function isExplicitlyRetryableModernFailure");
    const decision = decisionSrc.slice(decisionStart, decisionEnd);
    assert.equal(decision.includes("civic_media"), false);
    assert.equal(decision.includes("civic-media-center"), false);
    assert.equal(decision.includes('locale === "he"'), false);
    assert.equal(decision.includes("sourceKind"), false);
  });

  it("defers a same-version terminology failure until retryEligibleAt, without a provider call or Gate E", async () => {
    const row = initiative("defer", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    await assert.rejects(
      () => processContentTranslationWarmMemoryQueueForTests(),
      (error: unknown) => {
        assert.equal(isImmediateTerminalOutboxFailure(error), true);
        assert.equal(outboxPacingDeferAvailableAt(error), null);
        assert.equal(isActivationProviderTransientError(error), false);
        const message = error instanceof Error ? error.message : "";
        const meta = parseContentTranslationFailureMetadata(message);
        assert.equal(meta?.schema, "content_translation_failure_meta_v1");
        assert.equal(meta?.failureReasonCode, "TERMINOLOGY_PROTECTION_VIOLATION");
        assert.equal(meta?.sourceVersion, source.sourceVersion);
        assert.ok(meta?.retryEligibleAt);
        assert.ok(Date.parse(meta.retryEligibleAt) > Date.now());
        assert.ok(meta.localizationInputVersion);
        return true;
      },
    );
    assert.equal(providerCalls, 1);
    const stored = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(stored, null);

    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(preflight.failureReasonCode, "TERMINOLOGY_PROTECTION_VIOLATION");
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.ok(preflight.semanticRetryEligibleAt);

    const selected = selectCurrentlyRetryEligibleResiduals([
      residualFrom("initiative", row.initiativeId, preflight),
    ]);
    assert.equal(selected.length, 0);
    const schedule = selectReadyPresentationsForResidualRetry({
      RETRY_READY_IDENTITIES: 1,
      RETRY_BLOCKED_IDENTITIES: 0,
      ready: [residualFrom("initiative", row.initiativeId, preflight)],
      blocked: [],
      byFamilyReady: {},
      byLocaleReady: {},
    });
    assert.equal(schedule.length, 0);

    const quiet = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(quiet.length, 0);
    assert.equal(providerCalls, 1);
    const cooldown = await getThinGeminiCooldownSnapshot(Date.now());
    assert.equal(cooldown.active, false);

    const pacing = new LocalizationProviderPacingDeferredError("2026-09-30T19:00:00.000Z");
    assert.equal(outboxPacingDeferAvailableAt(pacing), "2026-09-30T19:00:00.000Z");
    assert.equal(isImmediateTerminalOutboxFailure(pacing), false);
  });

  it("does not select a due unchanged terminology failure", async () => {
    const row = initiative("due", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const dueAt = new Date(Date.now() - 1_000).toISOString();
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        reason: "TERMINOLOGY_PROTECTION_VIOLATION",
        hint: "deferred_semantic_retry",
        retryEligibleAt: dueAt,
      }),
    );

    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    const selected = selectCurrentlyRetryEligibleResiduals([
      residualFrom("initiative", row.initiativeId, preflight),
    ]);
    assert.equal(selected.length, 0);
    assert.equal(providerCalls, 0);

    providerMode = "valid";
    const retry = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.equal(retry.enqueued, true);
    const processed = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(providerCalls, 1);
    assert.equal(processed[0]?.outcome, "completed");
    const published = readContentTranslationWarmMemoryRecordForTests(retry.eventId!);
    assert.equal(published?.status, "published");
    assert.equal(published?.lastError, null);

    const stored = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.ok(stored);
    assert.equal(stored.freshness, "current");
    assert.notEqual(stored.stale, true);
    const validity = classifyContentTranslationValidity({
      translation: stored,
      liveSourceVersion: source.sourceVersion,
    });
    assert.equal(validity.reconciliationState, "READY");
    const title = String((stored.translatedContent as { title?: string }).title ?? "");
    assert.equal(title.includes("Союз Людства"), true);
    assert.equal(title.includes("Humanity Union"), false);
  });

  it("does not select a legacy unchanged terminology row that has no retryEligibleAt", async () => {
    const row = initiative("legacy", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        reason: "TERMINOLOGY_PROTECTION_VIOLATION",
        hint: "non_retryable_until_code_or_content_change",
      }),
    );
    const recorded = parseContentTranslationFailureMetadata(
      readContentTranslationWarmMemoryRecordForTests(enqueued.eventId)?.lastError,
    );
    assert.equal(recorded?.retryEligibleAt ?? null, null);

    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(
      selectCurrentlyRetryEligibleResiduals([
        residualFrom("initiative", row.initiativeId, preflight),
      ]).length,
      0,
    );
    assert.equal(providerCalls, 0);
  });

  it("advances the existing backoff after a repeated semantic failure", async () => {
    const row = initiative("backoff", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);

    const first = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const firstMeta = parseContentTranslationFailureMetadata(
      readContentTranslationWarmMemoryRecordForTests(first.eventId!)?.lastError,
    );
    assert.ok(firstMeta?.retryEligibleAt && firstMeta.failedAt);
    const firstDelay =
      Date.parse(firstMeta.retryEligibleAt) - Date.parse(firstMeta.failedAt);
    assert.ok(Math.abs(firstDelay - 10 * 60 * 1000) < 2_000);

    const second = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.equal(second.enqueued, true);
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const secondMeta = parseContentTranslationFailureMetadata(
      readContentTranslationWarmMemoryRecordForTests(second.eventId!)?.lastError,
    );
    assert.ok(secondMeta?.retryEligibleAt && secondMeta.failedAt);
    const secondDelay =
      Date.parse(secondMeta.retryEligibleAt) - Date.parse(secondMeta.failedAt);
    assert.ok(Math.abs(secondDelay - 20 * 60 * 1000) < 2_000);
    assert.ok(Date.parse(secondMeta.retryEligibleAt) > Date.parse(firstMeta.retryEligibleAt));

    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(
      selectCurrentlyRetryEligibleResiduals([
        residualFrom("initiative", row.initiativeId, preflight),
      ]).length,
      0,
    );
    const callsAfterBound = providerCalls;
    await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(providerCalls, callsAfterBound);
  });

  it("becomes eligible immediately when the source version changes", async () => {
    const row = initiative("version", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const before = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(before);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: before.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const meta = parseContentTranslationFailureMetadata(
      readContentTranslationWarmMemoryRecordForTests(enqueued.eventId!)?.lastError,
    );
    assert.ok(meta?.retryEligibleAt);
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: meta,
        liveSourceVersion: before.sourceVersion,
        nowMs: Date.now(),
      }),
      true,
    );

    updateInitiative(row.initiativeId, { title: "Neighborhood river plan" });
    const after = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(after);
    assert.notEqual(after.sourceVersion, before.sourceVersion);
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: meta,
        liveSourceVersion: after.sourceVersion,
        nowMs: Date.now(),
      }),
      false,
    );
    assert.equal(
      isSemanticResidualDeferActive({
        metadata: meta,
        liveSourceVersion: before.sourceVersion,
        liveLocalizationInputVersion: "input-version-changed",
        nowMs: Date.now(),
      }),
      false,
    );

    const preflight = await preflightFor(row.initiativeId, after.sourceVersion);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.semanticRetryDeferred, false);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(
      selectCurrentlyRetryEligibleResiduals([
        residualFrom("initiative", row.initiativeId, preflight),
      ]).length,
      1,
    );
  });

  it("becomes eligible when the localization input version changes", async () => {
    const row = initiative("input", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const meta = parseContentTranslationFailureMetadata(
      readContentTranslationWarmMemoryRecordForTests(enqueued.eventId!)?.lastError,
    );
    assert.ok(meta?.localizationInputVersion);
    const unchanged = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(unchanged.semanticRetryDeferred, true);
    assert.equal(
      selectCurrentlyRetryEligibleResiduals([
        residualFrom("initiative", row.initiativeId, unchanged),
      ]).length,
      0,
    );

    upsertTerminologyGlossaryMemory({
      conceptId: "humanity_union",
      canonicalEnglishTerm: "Humanity Union",
      category: "brand",
      status: "published",
      translations: {
        uk: { preferredTerm: "Союз людства", aliases: [] },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      updatedByParticipantId: null,
    });
    const changed = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(changed.ready, true);
    assert.equal(changed.semanticRetryDeferred, false);
    assert.equal(changed.terminalFailureForCurrentVersion, false);
    assert.equal(
      selectCurrentlyRetryEligibleResiduals([
        residualFrom("initiative", row.initiativeId, changed),
      ]).length,
      1,
    );
  });

  it("keeps a same-version non-provider validation failure terminal", async () => {
    const row = initiative("terminal", "Ordinary river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      failureMessage({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        reason: "UNCHANGED_SOURCE_PROSE",
        hint: "non_retryable_until_code_or_content_change",
      }),
    );
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.terminalFailureForCurrentVersion, true);
    assert.match(preflight.blockReason ?? "", /UNCHANGED_SOURCE_PROSE/);
    const terminalRow = residualFrom("initiative", row.initiativeId, preflight);
    const readyRows = [terminalRow].filter((candidate) => candidate.retryPreflight.ready);
    assert.equal(selectCurrentlyRetryEligibleResiduals(readyRows).length, 0);
    assert.equal(
      selectReadyPresentationsForResidualRetry({
        RETRY_READY_IDENTITIES: 0,
        RETRY_BLOCKED_IDENTITIES: 1,
        ready: readyRows,
        blocked: [terminalRow],
        byFamilyReady: {},
        byLocaleReady: {},
      }).length,
      0,
    );
    assert.equal(
      classifyLiveResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        preflightReady: preflight.ready,
        readyState: preflight.readyState,
        terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
      }),
      "BLOCKED_FAILED_ATTEMPT",
    );
  });

  it("does not select or rewrite an existing deferred proposal or blog retry time", () => {
    const proposalAt = "2026-09-30T21:33:34.000Z";
    const blogAt = "2026-09-30T18:39:49.000Z";
    const proposal = deferredResidual({
      sourceKind: "improvement_proposal",
      sourceRecordId: "initiative-structured-proposal-d51c18b5-87a7-412c-88f1-bc0221e6436f",
      retryEligibleAt: proposalAt,
    });
    const blog = deferredResidual({
      sourceKind: "blog_post",
      sourceRecordId: "blog-4a5b5014-cad6-41f1-a74d-1552d1dac7ca",
      retryEligibleAt: blogAt,
    });
    const before = JSON.stringify([proposal, blog]);
    const selected = selectCurrentlyRetryEligibleResiduals([proposal, blog]);
    assert.equal(selected.length, 0);
    assert.equal(JSON.stringify([proposal, blog]), before);
    assert.equal(proposal.retryPreflight.semanticRetryEligibleAt, proposalAt);
    assert.equal(blog.retryPreflight.semanticRetryEligibleAt, blogAt);
  });

  it("keeps an invalid terminology residual below READY and allows READY once it is current", async () => {
    const row = initiative("readiness", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      reason: "reconciliation",
      targetLocales: ["uk"],
    });
    await assert.rejects(() => processContentTranslationWarmMemoryQueueForTests());
    const preflight = await preflightFor(row.initiativeId, source.sourceVersion);
    const bucket = classifyLiveResidualIdentity({
      liveCurrent: false,
      liveStale: false,
      preflightReady: preflight.ready,
      readyState: preflight.readyState,
      terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
    });
    assert.equal(bucket, "RETRY_READY_MISSING");
    const open = accumulateLiveResidualCounts([bucket, "CURRENT"]);
    assert.equal(open.workItemsRequired > 0 || open.missing > 0, true);
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        participantWebUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: open,
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "BACKFILL_REQUIRED",
    );

    const closed = accumulateLiveResidualCounts(["CURRENT", "CURRENT"]);
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        participantWebUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: closed,
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "READY",
    );

    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: {
          status: "ready",
          dataReady: true,
          missingKeyCount: 0,
          emptyKeyCount: 0,
          requiredKeyCount: 10,
          effectiveSource: "remote",
          detail: "Public interface ready",
          preparationPhase: "ready",
          checkpointId: "cp-1",
          sourceHash: "hash-current",
          totalBatches: 1,
          completedBatches: 1,
          totalLeaves: 10,
          completedLeaves: 10,
          providerFailure: false,
          nextAttemptAt: null,
          transientFailureCount: 0,
          lastTransientFailure: null,
        } satisfies LanguageActivationWebUiDomainProgress,
        publicWebUiDataReady: true,
        participantWebUiDataReady: true,
      }),
      true,
    );
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: {
          status: "in_progress",
          dataReady: false,
          missingKeyCount: 1,
          emptyKeyCount: 0,
          requiredKeyCount: 10,
          effectiveSource: "remote",
          detail: null,
          preparationPhase: "structure_blocked",
          checkpointId: "cp-1",
          sourceHash: "hash-current",
          totalBatches: 1,
          completedBatches: 0,
          totalLeaves: 10,
          completedLeaves: 0,
          providerFailure: false,
          nextAttemptAt: "2026-09-30T05:02:04.321Z",
          transientFailureCount: 0,
          lastTransientFailure: null,
        } satisfies LanguageActivationWebUiDomainProgress,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });
});
