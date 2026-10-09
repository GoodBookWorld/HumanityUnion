/**
 * Empty Gemini candidate text is a bounded payload retry.
 * Stored EMPTY_TRANSLATION + deferred_semantic_retry shares that budget.
 * Genuine content-validation failures stay terminal.
 * Deterministic only — no live Gemini and no Mongo writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";
import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  ContentTranslationValidationError,
  SEMANTIC_RESIDUAL_DEFER_RETRY_HINT,
  decideSameVersionWarmFailureRetry,
  resolveValidationReasonCodeFromError,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  assertEligibleSourceFieldsFullyTranslated,
  assertTranslatedProseChangedFromSource,
} from "../../../src/modules/language/content-translation-output-validation.js";
import {
  selectInvalidProviderPayloadRetry,
  type InvalidProviderPayloadRetryAttempt,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { classifyContentTranslationMaterializationFailure } from "../../../src/modules/language/content-translation-warm-failure.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolvePublicTranslatedContent,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import {
  classifyActivationAutomaticProgress,
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";

const SOURCE_VERSION = "v-1-v-6268ff8ac13e5eea";
const RECORD_ID = "blog-57d5b2da-84f9-4ca4-96db-a02f8615ef09";
const FAR_FUTURE = Date.UTC(2026, 11, 1);

class CountingProvider {
  readonly providerId = "gemini" as const;
  callCount = 0;

  async translate(request: TranslationProviderRequest) {
    this.callCount += 1;
    const parsed = JSON.parse(request.text) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      translated[key] = `Localized prose for ${value}`;
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: this.providerId,
      isPlaceholder: false as const,
    };
  }
}

function attempt(
  index: number,
  overrides: Partial<InvalidProviderPayloadRetryAttempt> = {},
): InvalidProviderPayloadRetryAttempt {
  return {
    status: "failed",
    architectureRetryBasis: null,
    sourceVersion: SOURCE_VERSION,
    targetLocales: ["he"],
    attemptAt: new Date(Date.UTC(2026, 9, 1, 0, index, 0)).toISOString(),
    failureReasonCode: "EMPTY_TRANSLATION",
    failureTargetLocale: "he",
    retryabilityHint: SEMANTIC_RESIDUAL_DEFER_RETRY_HINT,
    localeFailures: [{ targetLocale: "he", failureReasonCode: "EMPTY_TRANSLATION" }],
    structuredOutputContract: "schema_v1",
    ...overrides,
  };
}

function payloadAttempt(index: number): InvalidProviderPayloadRetryAttempt {
  return attempt(index, {
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    retryabilityHint: "retryable",
    localeFailures: [{ targetLocale: "he", failureReasonCode: "INVALID_PROVIDER_PAYLOAD" }],
  });
}

const identity = {
  sourceKind: "blog_post",
  sourceRecordId: RECORD_ID,
  targetLocale: "he",
  sourceVersion: SOURCE_VERSION,
};

describe("empty Gemini candidate classification", () => {
  it("maps empty candidate text to INVALID_PROVIDER_PAYLOAD", () => {
    const error = new TranslationProviderError(
      "malformed_response",
      "Gemini returned empty translation",
    );
    assert.equal(resolveValidationReasonCodeFromError(error), "INVALID_PROVIDER_PAYLOAD");
    const classified = classifyContentTranslationMaterializationFailure(error);
    assert.equal(classified.failureReasonCode, "INVALID_PROVIDER_PAYLOAD");
    assert.equal(classified.failureClass, "PROVIDER_INVALID_RESPONSE");
    assert.equal(classified.retryability, "retryable");
  });

  it("keeps genuine empty translated fields invalid", () => {
    const sourceFields = { title: "Civic title", excerpt: "Excerpt", content: "<p>Body</p>" };
    assert.throws(
      () =>
        assertEligibleSourceFieldsFullyTranslated({
          sourceKind: "blog_post",
          sourceFields,
          translatedFields: { title: "", excerpt: "", content: "" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "he",
          sourceFields,
          translatedFields: { title: " ", excerpt: "", content: "" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "EMPTY_TRANSLATION",
    );
    const validation = new ContentTranslationValidationError(
      "EMPTY_TRANSLATION",
      "Translation provider returned no eligible non-empty translated fields.",
      "malformed_response",
    );
    assert.equal(resolveValidationReasonCodeFromError(validation), "EMPTY_TRANSLATION");
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "EMPTY_TRANSLATION",
        retryabilityHint: null,
      }),
      "terminal",
    );
  });

  it("does not remap other malformed provider errors to a fresh class", () => {
    assert.equal(
      resolveValidationReasonCodeFromError(
        new TranslationProviderError("malformed_response", "Gemini response was not JSON"),
      ),
      "INVALID_PROVIDER_PAYLOAD",
    );
    assert.equal(
      resolveValidationReasonCodeFromError(
        new TranslationProviderError(
          "malformed_response",
          "Translation provider returned unchanged source text for all eligible fields.",
        ),
      ),
      "UNCHANGED_SOURCE_PROSE",
    );
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_SOURCE_PROSE",
        retryabilityHint: SEMANTIC_RESIDUAL_DEFER_RETRY_HINT,
      }),
      "terminal",
    );
    assert.equal(
      decideSameVersionWarmFailureRetry({
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "MISSING_REQUIRED_PATH",
        retryabilityHint: SEMANTIC_RESIDUAL_DEFER_RETRY_HINT,
      }),
      "terminal",
    );
  });
});

describe("historical empty-provider budget", () => {
  it("counts stored EMPTY_TRANSLATION rows with the defer hint in the payload budget", () => {
    const due = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [0, 1, 2, 3, 4].map((index) => attempt(index)),
      nowMs: FAR_FUTURE,
    });
    assert.equal(due.outcome, "due");
    if (due.outcome === "due") {
      assert.equal(due.countedFailures, 5);
    }

    const withoutHint = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [attempt(0, { retryabilityHint: null })],
      nowMs: FAR_FUTURE,
    });
    assert.equal(withoutHint.outcome, "not_applicable");

    const otherCode = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [
        attempt(0, {
          failureReasonCode: "UNCHANGED_SOURCE_PROSE",
          localeFailures: [{ targetLocale: "he", failureReasonCode: "UNCHANGED_SOURCE_PROSE" }],
        }),
      ],
      nowMs: FAR_FUTURE,
    });
    assert.equal(otherCode.outcome, "not_applicable");
  });

  it("shares the cumulative cap with INVALID_PROVIDER_PAYLOAD and honors cooldown", () => {
    const mixed = [
      ...[0, 1, 2, 3].map((index) => attempt(index)),
      ...[4, 5, 6].map((index) => payloadAttempt(index)),
    ];
    const underCap = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: mixed,
      nowMs: FAR_FUTURE,
    });
    assert.equal(underCap.outcome, "due");
    if (underCap.outcome === "due") {
      assert.equal(underCap.countedFailures, 7);
    }

    const waiting = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: mixed,
      nowMs: Date.parse(mixed[6]!.attemptAt) + 60_000,
    });
    assert.equal(waiting.outcome, "waiting");
    if (waiting.outcome === "waiting") {
      assert.ok(Date.parse(waiting.retryEligibleAt) > Date.parse(mixed[6]!.attemptAt));
    }

    const exhausted = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: [...mixed, payloadAttempt(7)],
      nowMs: FAR_FUTURE,
    });
    assert.equal(exhausted.outcome, "exhausted");
    if (exhausted.outcome === "exhausted") {
      assert.equal(exhausted.countedFailures, 8);
    }
    assert.notEqual(exhausted.outcome, "recover_once");
    assert.notEqual(exhausted.outcome, "due");
  });

  it("does not grant a fresh budget or a second enqueue after the cap", () => {
    const schemaEra = Array.from({ length: 8 }, (_, index) => attempt(index));
    const capped = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: schemaEra,
      nowMs: FAR_FUTURE,
    });
    assert.equal(capped.outcome, "exhausted");

    const again = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: schemaEra,
      nowMs: FAR_FUTURE + 86_400_000,
    });
    assert.equal(again.outcome, "exhausted");

    const unstamped = selectInvalidProviderPayloadRetry({
      ...identity,
      attempts: Array.from({ length: 8 }, (_, index) =>
        attempt(index, { structuredOutputContract: null }),
      ),
      nowMs: FAR_FUTURE,
    });
    assert.equal(unstamped.outcome, "exhausted");
    assert.notEqual(unstamped.outcome, "recover_once");

    const otherLocale = selectInvalidProviderPayloadRetry({
      ...identity,
      targetLocale: "uk",
      attempts: schemaEra,
      nowMs: FAR_FUTURE,
    });
    assert.equal(otherLocale.outcome, "not_applicable");

    const nextVersion = selectInvalidProviderPayloadRetry({
      ...identity,
      sourceVersion: "v-next",
      attempts: schemaEra,
      nowMs: FAR_FUTURE,
    });
    assert.equal(nextVersion.outcome, "not_applicable");
  });
});

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-empty-provider-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-empty-provider",
    createdAt: now,
    updatedAt: now,
    title: `Empty provider title ${suffix}`,
    description: `Canonical English description for empty provider recovery ${suffix}.`,
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

function emptyProviderLastError(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLocale: string;
  readonly failureReasonCode?: string;
  readonly retryabilityHint?: string | null;
}): string {
  const failureReasonCode = input.failureReasonCode ?? "EMPTY_TRANSLATION";
  const retryabilityHint = input.retryabilityHint ?? SEMANTIC_RESIDUAL_DEFER_RETRY_HINT;
  return `CT_FAIL_META_V1:${JSON.stringify({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode,
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale,
    failedAt: "2026-10-01T00:00:00.000Z",
    retryabilityHint,
    structuredOutputContract: "schema_v1",
    localeFailures: [
      {
        targetLocale: input.targetLocale,
        failureClass: "VALIDATION_FAILED",
        failureReasonCode,
        retryabilityHint,
      },
    ],
  })}`;
}

describe("historical empty-provider preflight", () => {
  const createdIds: string[] = [];
  let provider: CountingProvider;

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    provider = new CountingProvider();
    setTranslationProviderForTests(provider);
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  async function seedFailed(input: {
    readonly initiativeId: string;
    readonly sourceVersion: string;
    readonly lastError: string;
  }): Promise<void> {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      sourceVersion: input.sourceVersion,
    });
    assert.equal(enqueued.enqueued, true);
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(enqueued.eventId, input.lastError);
  }

  function workItem(initiativeId: string, sourceVersion: string) {
    return {
      sourceKind: "initiative" as const,
      sourceRecordId: initiativeId,
      sourceVersion,
      targetLanguage: "uk" as const,
      state: "MISSING" as const,
      autoNodeCount: 1,
      missingOrStaleNodeCount: 1,
      fallbackPaths: ["title"],
    };
  }

  it("enters the payload budget and stays deferred inside the cooldown", async () => {
    const initiative = createInitiative(sampleInitiative("cooldown"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await seedFailed({
      initiativeId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      lastError: emptyProviderLastError({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
      }),
    });
    const callsBeforeRead = provider.callCount;
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: workItem(initiative.initiativeId, source.sourceVersion),
    });
    assert.equal(provider.callCount, callsBeforeRead);
    assert.equal(preflight.currentTranslationAbsent, true);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.ok(preflight.semanticRetryEligibleAt);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
  });

  it("stops same-version re-enqueue after the shared cap", async () => {
    const initiative = createInitiative(sampleInitiative("cap"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    for (let index = 0; index < 8; index += 1) {
      await seedFailed({
        initiativeId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        lastError: emptyProviderLastError({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          sourceVersion: source.sourceVersion,
          targetLocale: "uk",
        }),
      });
    }
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: workItem(initiative.initiativeId, source.sourceVersion),
    });
    assert.equal(provider.callCount, 0);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.readyState, "BLOCKED");
    assert.equal(preflight.terminalFailureForCurrentVersion, true);
    assert.equal(preflight.architectureRetryBasis, null);
  });

  it("leaves other terminal codes and current translations unchanged", async () => {
    const initiative = createInitiative(sampleInitiative("current"));
    createdIds.push(initiative.initiativeId);
    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(created.generated, true);
    assert.equal(provider.callCount, 1);
    const translationId = created.translation?.translationId;
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await seedFailed({
      initiativeId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      lastError: emptyProviderLastError({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
      }),
    });
    const current = await buildPublicLocalizationRetryPreflight({
      workItem: workItem(initiative.initiativeId, source.sourceVersion),
    });
    assert.equal(current.readyState, "CURRENT");
    assert.equal(current.ready, false);
    assert.equal(current.currentTranslationAbsent, false);

    const again = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(again.generated, false);
    assert.equal(again.translation?.translationId, translationId);
    assert.equal(provider.callCount, 1);

    const read = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: "uk",
      generateIfMissing: false,
    });
    assert.equal(provider.callCount, 1);
    assert.equal(read.translation?.translationId, translationId);

    const terminal = createInitiative(sampleInitiative("unchanged"));
    createdIds.push(terminal.initiativeId);
    const terminalSource = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: terminal.initiativeId,
    });
    assert.ok(terminalSource);
    await seedFailed({
      initiativeId: terminal.initiativeId,
      sourceVersion: terminalSource.sourceVersion,
      lastError: emptyProviderLastError({
        sourceKind: "initiative",
        sourceRecordId: terminal.initiativeId,
        sourceVersion: terminalSource.sourceVersion,
        targetLocale: "uk",
        failureReasonCode: "UNCHANGED_SOURCE_PROSE",
      }),
    });
    const blocked = await buildPublicLocalizationRetryPreflight({
      workItem: workItem(terminal.initiativeId, terminalSource.sourceVersion),
    });
    assert.equal(blocked.ready, false);
    assert.equal(blocked.terminalFailureForCurrentVersion, true);
    assert.equal(blocked.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    assert.equal(provider.callCount, 1);
  });
});

describe("activation terminal status", () => {
  function ownersReady() {
    const domains = emptyPendingDomains();
    return {
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
  }

  function report(
    ct: LanguageLocalizationReadinessReport["ct"],
    state: LanguageLocalizationReadinessReport["state"],
  ): LanguageLocalizationReadinessReport {
    return {
      engineReady: true,
      languageDataReady: true,
      state,
      ct,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    } as LanguageLocalizationReadinessReport;
  }

  it("stays running while CT work is active", () => {
    const ct = {
      ...emptyLanguageLocalizationCountBucket(),
      current: 30,
      activeWork: 1,
    };
    const state = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    const readiness = report(ct, state);
    const automaticProgress = classifyActivationAutomaticProgress({
      readiness,
      plpWork: [],
    });
    assert.equal(automaticProgress, "progress");
    assert.equal(
      deriveActivationJobStatus({
        readiness,
        domains: ownersReady(),
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress,
      }),
      "running",
    );
  });

  it("fails when the only remainder is terminal CT work", () => {
    const ct = {
      ...emptyLanguageLocalizationCountBucket(),
      current: 30,
      failed: 1,
    };
    const state = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(state, "DEGRADED");
    assert.notEqual(state, "READY");
    const readiness = report(ct, state);
    const automaticProgress = classifyActivationAutomaticProgress({
      readiness,
      plpWork: [],
    });
    assert.equal(automaticProgress, "exhausted");
    assert.equal(
      deriveActivationJobStatus({
        readiness,
        domains: ownersReady(),
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress,
      }),
      "failed",
    );
  });

  it("completes when every required translation is current", () => {
    const ct = {
      ...emptyLanguageLocalizationCountBucket(),
      current: 31,
    };
    const state = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct,
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(state, "READY");
    const readiness = report(ct, state);
    const automaticProgress = classifyActivationAutomaticProgress({
      readiness,
      plpWork: [],
    });
    assert.equal(
      deriveActivationJobStatus({
        readiness,
        domains: ownersReady(),
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress,
      }),
      "completed",
    );
  });
});
