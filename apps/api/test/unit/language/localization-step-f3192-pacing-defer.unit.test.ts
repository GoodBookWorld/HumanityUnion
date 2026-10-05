/**
 * STEP 15D.14.F.3.19.2 — preserve CT work across provider pacing defer.
 * Deterministic. No Gemini HTTP.
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
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationSourceOriginalEntityType,
} from "@hu/types";

import {
  isOutboxPendingDispatchDue,
  isImmediateTerminalOutboxFailure,
  outboxPacingDeferAvailableAt,
} from "../../../src/infrastructure/outbox/outbox.repository.js";
import { isActivationProviderTransientError } from "../../../src/modules/language/activation-provider-transient-recovery.js";
import { parseContentTranslationFailureMetadata } from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  classifyContentTranslationForReconciliation,
  classifyContentTranslationValidity,
} from "../../../src/modules/language/content-translation-validity.js";
import { readContentTranslationWarmMemoryRecordForTests } from "../../../src/modules/language/content-translation-warm-enqueue.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { accumulateLiveResidualCounts } from "../../../src/modules/language/live-residual-ct-coverage.js";
import { classifyLiveResidualIdentity } from "../../../src/modules/language/live-residual-identity.js";
import {
  LocalizationProviderPacingDeferredError,
  runLocalizationProviderRequest,
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
  type PublicLocalizationRetrySelection,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { resetContentTranslationWorkerConcurrencyForTests } from "../../../src/modules/language/content-translation-worker-concurrency.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";
import { upsertTerminologyGlossaryMemory } from "../../../src/modules/language/terminology-glossary/terminology-glossary.memory.store.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PACING_MS = 60_000;

function initiative(suffix: string, title: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-f3192-${suffix}`,
    stewardId: "member-f3192",
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
    targetLocale: "uk",
    translationState: input.invalid ? "INVALID" : input.stale ? "STALE" : "MISSING",
    sourceVersionMatch: "match",
    failureClass: input.invalid ? "VALIDATION_FAILED" : null,
    failureReasonCode: input.invalid ? "TERMINOLOGY_PROTECTION_VIOLATION" : null,
    retryability: input.deferred ? "deferred_semantic_retry" : null,
    lastFailureAt: null,
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
      currentTranslationAbsent: !input.invalid && !input.stale,
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
    },
  };
}

function selection(
  rows: readonly PublicLocalizationResidualWithPreflight[],
): PublicLocalizationRetrySelection {
  return {
    RETRY_READY_IDENTITIES: rows.length,
    RETRY_BLOCKED_IDENTITIES: 0,
    ready: rows,
    blocked: [],
    byFamilyReady: {},
    byLocaleReady: {},
  };
}

describe("F.3.19.2 pacing defer contract", () => {
  it("does not publish, complete, or fail a pacing defer, and waits out the permit", () => {
    const now = Date.parse("2026-09-29T00:21:26.205Z");
    const availableAt = new Date(now + PACING_MS).toISOString();
    const error = new LocalizationProviderPacingDeferredError(availableAt);

    assert.equal(outboxPacingDeferAvailableAt(error), availableAt);
    assert.equal(isImmediateTerminalOutboxFailure(error), false);
    assert.equal(isActivationProviderTransientError(error), false);
    assert.equal(error.message.includes("CT_FAIL_META_V1"), false);

    const deferred = {
      status: "pending" as const,
      attempts: 0,
      lastError: null,
      availableAt,
      publishedAt: null,
      claimCompleted: false,
    };
    assert.equal(deferred.status, "pending");
    assert.equal(deferred.publishedAt, null);
    assert.equal(deferred.claimCompleted, false);
    assert.equal(deferred.attempts, 0);
    assert.equal(deferred.lastError, null);
    assert.equal(parseContentTranslationFailureMetadata(deferred.lastError), null);

    for (const delta of [0, 2_000, 10_000, PACING_MS - 1]) {
      assert.equal(
        isOutboxPendingDispatchDue({
          status: "pending",
          availableAt,
          nowMs: now + delta,
        }),
        false,
      );
    }
    assert.equal(
      isOutboxPendingDispatchDue({
        status: "pending",
        availableAt,
        nowMs: now + PACING_MS,
      }),
      true,
    );
    assert.equal(
      isOutboxPendingDispatchDue({ status: "pending", availableAt: null, nowMs: now }),
      true,
    );

    const restarted = JSON.parse(JSON.stringify(deferred)) as typeof deferred;
    assert.equal(restarted.status, "pending");
    assert.equal(restarted.availableAt, availableAt);
    assert.equal(restarted.lastError, null);
    assert.equal(restarted.claimCompleted, false);
    assert.equal(
      isOutboxPendingDispatchDue({
        status: restarted.status,
        availableAt: restarted.availableAt,
        nowMs: now + 2_000,
      }),
      false,
    );
    assert.equal(
      isOutboxPendingDispatchDue({
        status: restarted.status,
        availableAt: restarted.availableAt,
        nowMs: now + PACING_MS,
      }),
      true,
    );

    const dispatcher = readFileSync(
      path.join(here, "../../../src/infrastructure/outbox/outbox.dispatcher.ts"),
      "utf8",
    );
    const repository = readFileSync(
      path.join(here, "../../../src/infrastructure/outbox/outbox.repository.ts"),
      "utf8",
    );
    const branchStart = dispatcher.indexOf("const pacingAvailableAt");
    const branchEnd = dispatcher.indexOf("lastError = error instanceof Error", branchStart);
    const branch = dispatcher.slice(branchStart, branchEnd);
    assert.ok(branchStart > 0 && branchEnd > branchStart);
    assert.match(branch, /deferOutboxRecordUntilAvailable/);
    assert.match(branch, /continue/);
    assert.doesNotMatch(branch, /markOutboxRecordPublished|markOutboxRecordFailed|markEventProcessingCompleted/);
    assert.ok(dispatcher.indexOf("releaseEventProcessingClaim") < branchStart);
    assert.match(repository, /availableAt: \{ \$exists: false \}/);
    assert.match(repository, /availableAt: \{ \$lte: now \}/);
    assert.match(repository, /\$set:\s*\{\s*availableAt/);
  });

  it("keeps INVALID → STALE → MISSING order and counts pacing-deferred invalid work", () => {
    const rows = [
      residual({ sourceKind: "civic_media", sourceRecordId: "civic-media-center" }),
      residual({ sourceKind: "blog_post", sourceRecordId: "blog-1" }),
      residual({
        sourceKind: "petition",
        sourceRecordId: "petition-1",
        stale: true,
      }),
      residual({
        sourceKind: "initiative",
        sourceRecordId: "initiative-1784349613932",
        invalid: true,
      }),
    ];
    const eligible = selectCurrentlyRetryEligibleResiduals(rows);
    assert.deepEqual(
      eligible.map((row) => row.presentationIdentity.sourceRecordId),
      ["initiative-1784349613932", "petition-1", "blog-1", "civic-media-center"],
    );
    const scheduled = selectReadyPresentationsForResidualRetry(selection(eligible));
    assert.deepEqual(
      scheduled.map((row) => row.sourceRecordId),
      ["initiative-1784349613932", "petition-1", "blog-1", "civic-media-center"],
    );

    const deferredInvalid = residual({
      sourceKind: "initiative",
      sourceRecordId: "initiative-1784349613932",
      invalid: true,
      deferred: true,
    });
    const withoutDeferred = selectCurrentlyRetryEligibleResiduals([
      deferredInvalid,
      ...rows.filter((row) => row.presentationIdentity.sourceKind !== "initiative"),
    ]);
    assert.equal(
      withoutDeferred.some((row) => row.presentationIdentity.sourceRecordId === "initiative-1784349613932"),
      false,
    );
    assert.equal(withoutDeferred.at(-1)?.presentationIdentity.sourceKind, "civic_media");

    const bucket = classifyLiveResidualIdentity({
      liveCurrent: false,
      liveStale: false,
      liveInvalid: true,
      preflightReady: true,
      readyState: "INVALID_PLACEHOLDER",
      terminalFailureForCurrentVersion: false,
    });
    const counts = accumulateLiveResidualCounts([bucket]);
    assert.equal(counts.invalid, 1);
    assert.equal(counts.workItemsRequired, 1);
    assert.equal(counts.current, 0);
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        participantWebUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: counts,
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "BACKFILL_REQUIRED",
    );
  });

  it("keeps Gate 15D.9.1 and public_news exclusion", () => {
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
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    assert.equal(
      (LANGUAGE_ACTIVATION_CT_OWNED_KINDS as readonly string[]).includes("public_news"),
      false,
    );
  });
});

describe("F.3.19.2 pacing defer preserves the warm event", () => {
  const created: string[] = [];
  let clockMs = 0;
  let providerCalls = 0;
  let providerMode: "translate" | "terminology" = "translate";

  beforeEach(async () => {
    clockMs = Date.parse("2026-09-29T00:21:26.205Z");
    providerCalls = 0;
    providerMode = "translate";
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
    setLocalizationProviderClockForTests(() => clockMs);
    setLocalizationProviderPacingIntervalMsForTests(null);
    const provider: TranslationProvider = {
      providerId: "gemini",
      async translate(request) {
        providerCalls += 1;
        if (providerMode === "terminology") {
          const source = JSON.parse(request.text) as Record<string, string>;
          const translated = Object.fromEntries(
            Object.entries(source).map(([key, value]) => [key, `Теплий ${key} ${value}`]),
          );
          return {
            translatedText: JSON.stringify(translated),
            providerId: "gemini",
            isPlaceholder: false,
          };
        }
        const source = JSON.parse(request.text) as Record<string, string>;
        const translated = Object.fromEntries(
          Object.entries(source).map(([key, value]) => [key, `Теплий переклад ${key} ${value}`]),
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

  async function storeInvalid(sourceRecordId: string, sourceVersion: string) {
    const now = "2026-09-09T20:52:11.161Z";
    await upsertContentTranslation({
      translationId: `tr-${sourceRecordId}`,
      sourceKind: "initiative",
      sourceRecordId,
      sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] title", description: "[uk] body" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: now,
      stale: false,
      freshness: "current",
    });
    return findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId,
      sourceVersion,
      targetLanguage: "uk",
    });
  }

  it("defers the same event, then the retry calls the provider once and publishes", async () => {
    const row = initiative("pacing", "Warm River Initiative");
    createInitiative(row);
    created.push(row.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
    });
    assert.ok(source);
    const before = await storeInvalid(row.initiativeId, source.sourceVersion);
    assert.ok(before);
    const beforeJson = JSON.stringify(before);

    setLocalizationProviderPacingIntervalMsForTests(PACING_MS);
    await runLocalizationProviderRequest(async () => "permit-held");
    assert.equal(providerCalls, 0);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.equal(enqueued.enqueued, true);
    assert.ok(enqueued.eventId);

    const first = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(first.length, 0);
    assert.equal(providerCalls, 0);
    const held = readContentTranslationWarmMemoryRecordForTests(enqueued.eventId);
    assert.ok(held);
    assert.equal(held.status, "pending");
    assert.equal(held.published, false);
    assert.equal(held.attempts, 0);
    assert.equal(held.lastError, null);
    assert.equal(parseContentTranslationFailureMetadata(held.lastError), null);
    assert.ok(held.availableAt);
    const availableMs = Date.parse(held.availableAt);
    assert.ok(availableMs > clockMs);

    const unchanged = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(JSON.stringify(unchanged), beforeJson);
    const cooldown = await getThinGeminiCooldownSnapshot(clockMs);
    assert.equal(cooldown.active, false);

    const again = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.equal(again.deduped, true);

    const hot = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(hot.length, 0);
    assert.equal(providerCalls, 0);
    assert.equal(
      isOutboxPendingDispatchDue({
        status: "pending",
        availableAt: held.availableAt,
        nowMs: clockMs + 2_000,
      }),
      false,
    );

    const restarted = JSON.parse(JSON.stringify(held)) as typeof held;
    assert.equal(restarted.status, "pending");
    assert.equal(restarted.published, false);
    assert.equal(restarted.availableAt, held.availableAt);

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.readyState, "INVALID_PLACEHOLDER");
    assert.equal(preflight.liveTranslationInvalid, true);
    assert.notEqual(preflight.semanticRetryDeferred, true);
    const bucket = classifyLiveResidualIdentity({
      liveCurrent: false,
      liveStale: preflight.liveTranslationStale === true,
      liveInvalid: preflight.liveTranslationInvalid === true,
      preflightReady: preflight.ready,
      readyState: preflight.readyState,
      terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
    });
    const counts = accumulateLiveResidualCounts([bucket]);
    assert.equal(counts.invalid, 1);
    assert.equal(counts.workItemsRequired, 1);
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        participantWebUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: counts,
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "BACKFILL_REQUIRED",
    );

    clockMs = availableMs + 1;
    const retried = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(providerCalls, 1);
    assert.equal(retried.length, 1);
    assert.equal(retried[0]?.outcome, "completed");
    const published = readContentTranslationWarmMemoryRecordForTests(enqueued.eventId);
    assert.equal(published?.status, "published");
    assert.equal(published?.published, true);
    assert.equal(published?.lastError, null);

    const stored = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.ok(stored);
    assert.notEqual(stored.translationProvider, "deterministic");
    const validity = classifyContentTranslationValidity({
      translation: stored,
      liveSourceVersion: source.sourceVersion,
    });
    assert.equal(validity.reconciliationState, "READY");

    const replay = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.equal(replay.enqueued, true);
    const second = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(providerCalls, 1);
    assert.equal(second[0]?.locales[0]?.status, "skipped_existing");
  });

  it("persists terminology-inexact prose without a provider failure or Gate E", async () => {
    providerMode = "terminology";
    const row = initiative("semantic", "Humanity Union river plan");
    createInitiative(row);
    created.push(row.initiativeId);
    setLocalizationProviderPacingIntervalMsForTests(null);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    const processed = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(processed[0]?.outcome, "completed");
    const published = readContentTranslationWarmMemoryRecordForTests(enqueued.eventId);
    assert.equal(published?.status, "published");
    assert.equal(published?.lastError, null);
    const stored = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: row.initiativeId,
      sourceVersion: (await loadTranslatableSource({
        sourceKind: "initiative",
        sourceRecordId: row.initiativeId,
      }))!.sourceVersion,
      targetLanguage: "uk",
    });
    assert.ok(stored);
    const validity = classifyContentTranslationForReconciliation({
      translation: stored,
      liveSourceVersion: stored.sourceVersion,
      originalFields: {
        title: row.title,
        description: row.description,
      },
      concepts: [
        {
          conceptId: "humanity_union",
          canonicalEnglishTerm: "Humanity Union",
          category: "brand",
          status: "published",
          translations: { uk: { preferredTerm: "Союз Людства", aliases: [] } },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(validity.presentationEligible, true);
    assert.equal(validity.workRemaining, false);
    const cooldown = await getThinGeminiCooldownSnapshot(clockMs);
    assert.equal(cooldown.active, false);
    assert.equal(providerCalls, 1);
  });
});
