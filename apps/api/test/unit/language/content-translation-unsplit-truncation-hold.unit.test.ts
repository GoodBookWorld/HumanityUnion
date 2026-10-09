/**
 * Unsplit truncation safety gate.
 * A due truncated identity stays deferred until the single-response path is
 * replaced. Other payload kinds, locales, and identities stay selectable.
 * Deterministic only — no live Gemini and no Mongo writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative, LanguageCode } from "@hu/types";

import { SEMANTIC_RESIDUAL_DEFER_STREAK_CAP } from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  contentTranslationUsesUnsplitSingleResponse,
  selectInvalidProviderPayloadRetry,
  shouldHoldAutomaticRetryForUnsplitTruncation,
  type InvalidProviderPayloadRetryAttempt,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { classifyLiveResidualIdentity } from "../../../src/modules/language/live-residual-identity.js";
import {
  assessLocalizationReconciliationEligibility,
  LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
  peekLocalizationReconciliationDriverStateForTests,
  resetLocalizationReconciliationDriverForTests,
  runLocalizationReconciliationPass,
  scheduleLocalizationReconciliation,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import {
  buildPublicLocalizationRetryPreflight,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  listContentTranslationWarmAttempts,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  selectCurrentlyRetryEligibleResiduals,
} from "../../../src/modules/language/public-localization-residual-retry.js";
import {
  selectReadyPresentationsForResidualRetry,
  type PublicLocalizationResidualWithPreflight,
} from "../../../src/modules/language/public-localization-retry-preflight.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const SOURCE_VERSION = "v-source-long-prose";
const DUE_AT = "2020-01-01T00:00:00.000Z";
const FAR_FUTURE = Date.UTC(2026, 11, 1);

function attempt(
  index: number,
  overrides: Partial<InvalidProviderPayloadRetryAttempt> = {},
): InvalidProviderPayloadRetryAttempt {
  return {
    status: "failed",
    architectureRetryBasis: null,
    sourceVersion: SOURCE_VERSION,
    targetLocales: ["uk"],
    attemptAt: new Date(Date.UTC(2020, 0, 1, 0, index, 0)).toISOString(),
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    failureTargetLocale: "uk",
    retryabilityHint: "retryable",
    structuredOutputContract: "schema_v1",
    providerPayloadKind: "truncated",
    ...overrides,
  };
}

function remainingAttempts(countedFailures: number, outcome: string): number {
  if (outcome === "recover_once") return 1;
  if (outcome === "exhausted") return 0;
  if (outcome === "not_applicable") return SEMANTIC_RESIDUAL_DEFER_STREAK_CAP;
  return Math.max(0, SEMANTIC_RESIDUAL_DEFER_STREAK_CAP - countedFailures);
}

describe("unsplit truncation retry safety gate", () => {
  it("defers a due truncated identity and keeps the retry count", () => {
    const attempts = Array.from({ length: 7 }, (_, index) => attempt(index));
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "blog_post",
      sourceRecordId: "post-long-prose",
      targetLocale: "uk",
      sourceVersion: SOURCE_VERSION,
      attempts,
      nowMs: FAR_FUTURE,
    });
    assert.equal(decision.outcome, "due");
    assert.equal(decision.countedFailures, 7);
    assert.equal(remainingAttempts(decision.countedFailures, decision.outcome), 1);
    assert.equal(contentTranslationUsesUnsplitSingleResponse(), true);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: SOURCE_VERSION,
        targetLocale: "uk",
        attempts,
        retryOutcome: decision.outcome,
      }),
      true,
    );
  });

  it("leaves empty_candidate, malformed_json, and cooldown waiting unchanged", () => {
    const identity = {
      sourceKind: "petition",
      sourceRecordId: "petition-1",
      targetLocale: "de",
      sourceVersion: SOURCE_VERSION,
    };
    for (const providerPayloadKind of ["empty_candidate", "malformed_json"] as const) {
      const attempts = [attempt(0, { providerPayloadKind, failureTargetLocale: "de", targetLocales: ["de"] })];
      const decision = selectInvalidProviderPayloadRetry({
        ...identity,
        attempts,
        nowMs: FAR_FUTURE,
      });
      assert.equal(decision.outcome, "due");
      assert.equal(decision.countedFailures, 1);
      assert.equal(
        shouldHoldAutomaticRetryForUnsplitTruncation({
          sourceVersion: SOURCE_VERSION,
          targetLocale: "de",
          attempts,
          retryOutcome: decision.outcome,
        }),
        false,
      );
    }

    const waitingAttempts = [
      attempt(0, { attemptAt: new Date(FAR_FUTURE).toISOString() }),
    ];
    const waiting = selectInvalidProviderPayloadRetry({
      sourceKind: "blog_post",
      sourceRecordId: "post-long-prose",
      targetLocale: "uk",
      sourceVersion: SOURCE_VERSION,
      attempts: waitingAttempts,
      nowMs: FAR_FUTURE,
    });
    assert.equal(waiting.outcome, "waiting");
    assert.equal(waiting.countedFailures, 1);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: SOURCE_VERSION,
        targetLocale: "uk",
        attempts: waitingAttempts,
        retryOutcome: waiting.outcome,
      }),
      false,
    );
  });

  it("uses the latest counted kind and ignores another locale", () => {
    const attempts = [
      attempt(0, { providerPayloadKind: "truncated" }),
      attempt(1, { providerPayloadKind: "malformed_json" }),
    ];
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "civic_archive",
      sourceRecordId: "archive-1",
      targetLocale: "uk",
      sourceVersion: SOURCE_VERSION,
      attempts,
      nowMs: FAR_FUTURE,
    });
    assert.equal(decision.countedFailures, 2);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: SOURCE_VERSION,
        targetLocale: "uk",
        attempts,
        retryOutcome: "due",
      }),
      false,
    );
    const otherLocale = [
      attempt(0, { providerPayloadKind: "malformed_json" }),
      attempt(1, {
        providerPayloadKind: "truncated",
        failureTargetLocale: "fr",
        targetLocales: ["fr"],
      }),
    ];
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: SOURCE_VERSION,
        targetLocale: "uk",
        attempts: otherLocale,
        retryOutcome: "due",
      }),
      false,
    );
  });

  it("releases the same attempts when the single-response path is inactive", () => {
    const attempts = Array.from({ length: 7 }, (_, index) => attempt(index));
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "blog_post",
      sourceRecordId: "post-long-prose",
      targetLocale: "uk",
      sourceVersion: SOURCE_VERSION,
      attempts,
      nowMs: FAR_FUTURE,
    });
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: SOURCE_VERSION,
        targetLocale: "uk",
        attempts,
        retryOutcome: decision.outcome,
        singleResponseActive: false,
      }),
      false,
    );
    assert.equal(decision.countedFailures, 7);
    assert.equal(decision.outcome, "due");
  });

  it("keeps a deferred truncated identity out of enqueue and selects the sibling", () => {
    const held = residualRow({
      sourceRecordId: "post-long-prose",
      targetLocale: "uk",
      deferred: true,
    });
    const sibling = residualRow({
      sourceRecordId: "post-short-prose",
      targetLocale: "de",
      deferred: false,
    });
    const selected = selectCurrentlyRetryEligibleResiduals([held, sibling]);
    assert.deepEqual(
      selected.map((row) => row.presentationIdentity.sourceRecordId),
      ["post-short-prose"],
    );
    const schedule = selectReadyPresentationsForResidualRetry({
      RETRY_READY_IDENTITIES: 2,
      RETRY_BLOCKED_IDENTITIES: 0,
      ready: [held, sibling],
      blocked: [],
      byFamilyReady: {},
      byLocaleReady: {},
    });
    assert.equal(schedule.length, 1);
    assert.equal(schedule[0]?.sourceRecordId, "post-short-prose");
    assert.deepEqual(schedule[0]?.targetLocales, ["de"]);
  });
});

describe("unsplit truncation preflight", () => {
  const createdIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
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
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  async function seedFailed(input: {
    readonly initiativeId: string;
    readonly sourceVersion: string;
    readonly targetLocale: "uk" | "de";
    readonly providerPayloadKind: "truncated" | "empty_candidate" | "malformed_json";
    readonly failedAt: string;
  }): Promise<void> {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: input.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: [input.targetLocale],
      sourceVersion: input.sourceVersion,
    });
    assert.equal(enqueued.enqueued, true);
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      payloadLastError(input),
      input.failedAt,
    );
  }

  it("holds a due truncated source version without marking it ready or blocked", async () => {
    const initiative = createInitiative(sampleInitiative("truncated-due"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    for (let index = 0; index < 7; index += 1) {
      await seedFailed({
        initiativeId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
        providerPayloadKind: "truncated",
        failedAt: new Date(Date.UTC(2020, 0, 1, 0, index, 0)).toISOString(),
      });
    }
    const attempts = await listContentTranslationWarmAttempts({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 50,
    });
    const decision = selectInvalidProviderPayloadRetry({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
      attempts: attempts.map((row) => ({
        status: row.status,
        architectureRetryBasis: row.architectureRetryBasis,
        sourceVersion: row.sourceVersion,
        targetLocales: row.targetLocales,
        attemptAt: row.attemptAt,
        failureReasonCode: row.failureMetadata?.failureReasonCode ?? null,
        failureTargetLocale:
          typeof row.failureMetadata?.targetLocale === "string"
            ? row.failureMetadata.targetLocale
            : null,
        retryabilityHint: row.failureMetadata?.retryabilityHint ?? null,
        localeFailures: row.failureMetadata?.localeFailures ?? null,
        structuredOutputContract: row.failureMetadata?.structuredOutputContract ?? null,
        providerPayloadKind: row.failureMetadata?.providerPayloadKind ?? null,
      })),
      nowMs: FAR_FUTURE,
    });
    assert.equal(decision.countedFailures, 7);
    assert.equal(decision.outcome, "due");
    assert.equal(remainingAttempts(decision.countedFailures, decision.outcome), 1);

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: workItem(initiative.initiativeId, source.sourceVersion, "uk"),
    });
    assert.equal(preflight.ready, true);
    assert.equal(preflight.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(preflight.currentTranslationAbsent, true);
    assert.equal(preflight.terminalFailureForCurrentVersion, false);
    assert.equal(preflight.semanticRetryDeferred, true);
    assert.equal(preflight.semanticRetryEligibleAt ?? null, null);
    assert.equal(
      classifyLiveResidualIdentity({
        liveCurrent: false,
        liveStale: false,
        preflightReady: preflight.ready,
        readyState: preflight.readyState,
        terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
      }),
      "RETRY_READY_MISSING",
    );
    const after = await listContentTranslationWarmAttempts({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 50,
    });
    assert.equal(after.length, 7);
  });

  it("still selects empty_candidate and malformed_json once the cooldown has passed", async () => {
    for (const providerPayloadKind of ["empty_candidate", "malformed_json"] as const) {
      const initiative = createInitiative(sampleInitiative(providerPayloadKind));
      createdIds.push(initiative.initiativeId);
      const source = await loadTranslatableSource({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      });
      assert.ok(source);
      await seedFailed({
        initiativeId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLocale: "uk",
        providerPayloadKind,
        failedAt: DUE_AT,
      });
      const preflight = await buildPublicLocalizationRetryPreflight({
        workItem: workItem(initiative.initiativeId, source.sourceVersion, "uk"),
      });
      assert.equal(preflight.ready, true);
      assert.equal(preflight.readyState, "MISSING_READY_FOR_WARM");
      assert.equal(preflight.semanticRetryDeferred, false);
      assert.equal(preflight.currentTranslationAbsent, true);
    }
  });
});

describe("unsplit truncation reconciliation backoff", () => {
  beforeEach(() => {
    resetLocalizationReconciliationDriverForTests();
  });

  afterEach(() => {
    resetLocalizationReconciliationDriverForTests();
  });

  it("backs off when the only remaining identity is deferred and does not loop", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("uk"),
      assessWebUi: async () => ({ dataReady: true as const }),
      measureCtWork: async () => ({
        ct: {
          current: 0,
          missing: 1,
          stale: 0,
          invalid: 0,
          failed: 0,
          pending: 0,
          workItemsRequired: 1,
        },
        kindRows: [],
      }),
      planBackfill: async () => ({
        pack: "closure07" as const,
        locale: "uk",
        mode: "dry-run" as const,
        registryEligible: true,
        items: [],
        excluded: [],
        summary: { ctWorkItems: 1, plpWorkItems: 0, skippedCurrent: 0 },
        PROVIDER_CALLS: 0 as const,
        WRITES_PERFORMED: 0 as const,
      }),
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      runResidual: async () => {
        residualCalls += 1;
        return {
          mode: "execute" as const,
          preAudit: {} as never,
          selection: { ready: [], blocked: [] } as never,
          RETRY_READY_IDENTITIES: 1,
          RETRY_BLOCKED_IDENTITIES: 0,
          RETRY_SELECTED_IDENTITIES: 0,
          selectedIdentities: [],
          blockedIdentities: [],
          schedule: [],
          presentationsToEnqueue: 0,
          presentationGroupingExplained: false,
          selectedWorkItems: [],
          presentationsScheduled: 0,
          presentationsDeduped: 0,
          presentationsFailed: 0,
          enqueueResults: [],
          abortReason: null,
        };
      },
      enqueuePlp: async () => undefined,
    });

    const eligibility = await assessLocalizationReconciliationEligibility("uk");
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.workItemsRequired, 1);

    const pass = await runLocalizationReconciliationPass("uk");
    assert.equal(pass.presentationsScheduled, 0);
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
    assert.equal(pass.continuationScheduled, true);
    assert.ok(pass.continuationDelayMs >= LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS);
    assert.equal(pass.currentAfter, 0);

    scheduleLocalizationReconciliation({ locale: "uk", reason: "test", delayMs: 0 });
    await flushMicrotasks();
    scheduleLocalizationReconciliation({ locale: "uk", reason: "test", delayMs: 0 });
    await flushMicrotasks();
    const state = peekLocalizationReconciliationDriverStateForTests();
    assert.equal(residualCalls, 2);
    assert.equal(state.delayedLocales.length, 1);
    const dueAt = state.delayedDueAtMs.uk;
    assert.ok(
      dueAt != null &&
        dueAt - Date.now() >= LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS - 1000,
    );
  });
});

function residualRow(input: {
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly deferred: boolean;
}): PublicLocalizationResidualWithPreflight {
  return {
    family: "initiative",
    presentationIdentity: {
      sourceKind: "initiative",
      sourceRecordId: input.sourceRecordId,
    },
    targetLocale: input.targetLocale,
    translationState: "MISSING",
    sourceVersionMatch: "no_row",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    retryability: "retryable",
    lastFailureAt: DUE_AT,
    outboxDisposition: "failed",
    mayScheduleNewWarm: true,
    retryPreflight: {
      sourceResolvable: true,
      presentationValid: true,
      localeEligible: true,
      currentTranslationAbsent: true,
      terminalFailureForCurrentVersion: false,
      activeWorkAbsent: true,
      architectureRetryBasis: null,
      failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      ready: true,
      readyState: "MISSING_READY_FOR_WARM",
      blockReason: null,
      semanticRetryDeferred: input.deferred,
      semanticRetryEligibleAt: null,
    },
    latestAttemptAt: DUE_AT,
    latestAttemptReason: null,
    latestAttemptTargetLocale: input.targetLocale,
    failureMetadataVersion: SOURCE_VERSION,
  };
}

function workItem(initiativeId: string, sourceVersion: string, targetLanguage: "uk" | "de") {
  return {
    sourceKind: "initiative" as const,
    sourceRecordId: initiativeId,
    sourceVersion,
    targetLanguage,
    state: "MISSING" as const,
    autoNodeCount: 1,
    missingOrStaleNodeCount: 1,
    fallbackPaths: ["title"],
  };
}

function payloadLastError(input: {
  readonly initiativeId: string;
  readonly sourceVersion: string;
  readonly targetLocale: string;
  readonly providerPayloadKind: string;
  readonly failedAt: string;
}): string {
  return `CT_FAIL_META_V1:${JSON.stringify({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    sourceKind: "initiative",
    sourceRecordId: input.initiativeId,
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale,
    failedAt: input.failedAt,
    retryabilityHint: "retryable",
    structuredOutputContract: "schema_v1",
    providerPayloadKind: input.providerPayloadKind,
  })}`;
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-truncation-hold-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-truncation-hold",
    createdAt: now,
    updatedAt: now,
    title: `Truncation hold title ${suffix}`,
    description: `Canonical English description for truncation hold ${suffix}.`,
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

function registryRecord(locale: string) {
  return {
    languageId: `lang-${locale}`,
    locale,
    enabled: true,
    contentTranslationEnabled: true,
    searchEnabled: false,
    seoIndexingEnabled: false,
    displayName: locale,
    nativeName: locale,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}
