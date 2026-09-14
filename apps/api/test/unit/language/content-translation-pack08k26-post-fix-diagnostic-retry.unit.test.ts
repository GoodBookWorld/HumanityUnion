/**
 * Pack 08K.2.6 — controlled post-fix diagnostic retry.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  assertExplicitPostFixExecuteGuards,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  evaluateExplicitPostFixDiagnosticRetryEligibility,
  explainResidualsOnly,
  listContentTranslationWarmAttemptsBounded,
  markContentTranslationWarmMemoryFailedForTests,
  parseContentTranslationFailureMetadata,
  peekContentTranslationWarmOutboxFailure,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetResidualDiagnosticCountersForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationWorkerConcurrency,
  runExplicitResidualsAfterFailureReasonFix,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { DeterministicTranslationProvider } from "../../../src/modules/language/providers/deterministic-translation-provider.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryPublishedForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { PublicLocalizationResidualWithPreflight } from "../../../src/modules/language/public-localization-retry-preflight.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k26-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k26",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K26 Initiative ${suffix}`,
    description: `Canonical English prose for post-fix retry ${suffix}.`,
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

function historicalCollapsedMeta(input: {
  sourceRecordId: string;
  targetLocale: string;
}): string {
  // Persist literally as staging did pre-08K.2.5 (bypass encode normalizer).
  return `CT_FAIL_META_V1:${JSON.stringify({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "VALIDATION_FAILED",
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v-hist",
    targetLocale: input.targetLocale,
    failedAt: "2026-09-04T00:00:00.000Z",
    retryabilityHint: "non_retryable_until_code_or_content_change",
    localeFailures: [
      {
        targetLocale: input.targetLocale,
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "VALIDATION_FAILED",
        retryabilityHint: "non_retryable_until_code_or_content_change",
      },
    ],
  })}`;
}

function modernExactMeta(input: {
  sourceRecordId: string;
  targetLocale: string;
  failureReasonCode: string;
  failureClass?: string;
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: input.failureClass ?? "VALIDATION_FAILED",
    failureReasonCode: input.failureReasonCode,
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v-modern",
    targetLocale: input.targetLocale,
    failedAt: new Date().toISOString(),
    retryabilityHint:
      input.failureReasonCode === "INVALID_PROVIDER_PAYLOAD"
        ? "retryable"
        : "non_retryable_until_code_or_content_change",
  });
}

function stubResidual(
  overrides: Partial<PublicLocalizationResidualWithPreflight> & {
    targetLocale: string;
    sourceRecordId: string;
  },
): PublicLocalizationResidualWithPreflight {
  return {
    family: "initiative",
    presentationIdentity: {
      sourceKind: "initiative",
      sourceRecordId: overrides.sourceRecordId,
    },
    targetLocale: overrides.targetLocale as PublicLocalizationResidualWithPreflight["targetLocale"],
    translationState: overrides.translationState ?? "TERMINAL_FAILED",
    sourceVersionMatch: "unloaded",
    failureClass: overrides.failureClass ?? "VALIDATION_FAILED",
    failureReasonCode: overrides.failureReasonCode ?? "VALIDATION_FAILED",
    retryability: overrides.retryability ?? "non_retryable_until_code_or_content_change",
    lastFailureAt: "2026-09-04T00:00:00.000Z",
    outboxDisposition: overrides.outboxDisposition ?? "failed",
    mayScheduleNewWarm: overrides.mayScheduleNewWarm ?? false,
    retryPreflight: {
      sourceResolvable: true,
      presentationValid: true,
      localeEligible: true,
      currentTranslationAbsent: true,
      terminalFailureForCurrentVersion: true,
      activeWorkAbsent: true,
      architectureRetryBasis: null,
      failureReasonCode: overrides.failureReasonCode ?? "VALIDATION_FAILED",
      ready: false,
      readyState: "BLOCKED",
      blockReason: "blocked",
      ...overrides.retryPreflight,
    },
    latestAttemptAt: "2026-09-04T00:00:00.000Z",
    latestAttemptReason: "operator_residual_retry",
    latestAttemptTargetLocale: overrides.targetLocale,
    failureMetadataVersion:
      overrides.failureMetadataVersion ?? "content_translation_failure_meta_v1",
  };
}

class ScriptedStructuredTranslationProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  constructor(
    private readonly script: (
      request: TranslationProviderRequest,
    ) => Record<string, string> | string,
  ) {}

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    const payload = this.script(request);
    return {
      translatedText: typeof payload === "string" ? payload : JSON.stringify(payload),
      providerId: this.providerId,
      isPlaceholder: false,
    };
  }
}

async function drainMemoryWarmQueueSoft(): Promise<void> {
  const pending = listContentTranslationWarmMemoryPendingForTests();
  for (const row of pending) {
    try {
      await processContentTranslationWarmRequested(row.command);
      markContentTranslationWarmMemoryPublishedForTests(row.eventId);
    } catch (error) {
      markContentTranslationWarmMemoryFailedForTests(
        row.eventId,
        error instanceof Error ? error.message : "warm memory drain failure",
      );
    }
  }
}

describe("Pack 08K.2.6 — controlled post-fix diagnostic retry", () => {
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    resetResidualDiagnosticCountersForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    await ensureLanguageRegistrySeeded();
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      await updateLanguageRegistryRecord(`lang-${locale}`, {
        enabled: true,
        contentTranslationEnabled: true,
      });
    }
  });

  afterEach(() => {
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    resetTranslationProviderForTests();
  });

  it("A. historical generic + explicit + flag => eligible", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-a",
        targetLocale: "uk",
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, true);
    assert.equal(
      eligibility.architectureRetryBasis,
      CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
    );
    assert.equal(eligibility.selectionPath, "post_fix_diagnostic_override");
  });

  it("B. same without explicit identity => ineligible", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({ sourceRecordId: "id-b", targetLocale: "uk" }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: false,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
  });

  it("C. same without flag => ineligible", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({ sourceRecordId: "id-c", targetLocale: "uk" }),
      postFixFlagEnabled: false,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
  });

  it("D. modern exact validation failure => no override", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-d",
        targetLocale: "uk",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
    assert.match(eligibility.blockReason ?? "", /UNCHANGED_CIVIC_TITLE/);
  });

  it("E. post-fix basis already attempted => no second override", async () => {
    const initiative = sampleInitiative("second");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const first = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(first.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      first.eventId,
      historicalCollapsedMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );
    const override = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      architectureRetryBasis:
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
      requestedAt: "2026-09-05T12:00:00.000Z",
    });
    assert.ok(override.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      override.eventId,
      modernExactMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "UNCHANGED_SOURCE_PROSE",
      }),
    );

    const plan = await runExplicitResidualsAfterFailureReasonFix({
      execute: false,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(plan.SELECTED_IDENTITIES, 0);
    assert.match(
      plan.blockedIdentities[0]?.blockReason ?? "",
      /EXACT_FAILURE_REASON_PROPAGATION_08K25 already attempted/,
    );
  });

  it("F. INVALID_PROVIDER_PAYLOAD remains normally eligible", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-f",
        targetLocale: "zh-Hant",
        failureClass: "PROVIDER_INVALID_RESPONSE",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.selectionPath, "normal_invalid_provider_payload");
    assert.equal(
      eligibility.architectureRetryBasis,
      CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.VALIDATION_DIAGNOSTICS_CONTRACT_v1,
    );
  });

  it("G. CURRENT identity => excluded", async () => {
    const initiative = sampleInitiative("current");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    await upsertContentTranslation({
      translationId: "tr-08k26-current",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] ok", description: "[uk] ok" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      historicalCollapsedMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );

    const plan = await runExplicitResidualsAfterFailureReasonFix({
      execute: false,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(plan.SELECTED_IDENTITIES, 0);
  });

  it("H. active attempt => excluded", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-h",
        targetLocale: "uk",
        retryPreflight: {
          sourceResolvable: true,
          presentationValid: true,
          localeEligible: true,
          currentTranslationAbsent: true,
          terminalFailureForCurrentVersion: true,
          activeWorkAbsent: false,
          architectureRetryBasis: null,
          failureReasonCode: "VALIDATION_FAILED",
          ready: false,
          readyState: "ACTIVE_WORK",
          blockReason: "active",
        },
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
  });

  it("I. source unavailable/private => excluded", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-i",
        targetLocale: "uk",
        retryPreflight: {
          sourceResolvable: false,
          presentationValid: false,
          localeEligible: true,
          currentTranslationAbsent: true,
          terminalFailureForCurrentVersion: true,
          activeWorkAbsent: true,
          architectureRetryBasis: null,
          failureReasonCode: "VALIDATION_FAILED",
          ready: false,
          readyState: "BLOCKED",
          blockReason: "missing source",
        },
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
  });

  it("J. disabled locale => excluded", () => {
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual: stubResidual({
        sourceRecordId: "id-j",
        targetLocale: "uk",
        retryPreflight: {
          sourceResolvable: true,
          presentationValid: true,
          localeEligible: false,
          currentTranslationAbsent: true,
          terminalFailureForCurrentVersion: true,
          activeWorkAbsent: true,
          architectureRetryBasis: null,
          failureReasonCode: "VALIDATION_FAILED",
          ready: false,
          readyState: "BLOCKED",
          blockReason: "locale",
        },
      }),
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: false,
    });
    assert.equal(eligibility.eligible, false);
  });

  it("K. production => hard refused", () => {
    assert.throws(
      () =>
        assertExplicitPostFixExecuteGuards({
          mongoFlag: true,
          execute: true,
          databaseName: "humanity_union_staging",
          allowFlag: "true",
          platformMode: "production",
          nodeEnv: "staging",
          stagingDatabase: "humanity_union_staging",
          allowEnvName: "ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION",
        }),
      /PLATFORM_MODE=production/,
    );
  });

  it("L. wrong DB => refused", () => {
    assert.throws(
      () =>
        assertExplicitPostFixExecuteGuards({
          mongoFlag: true,
          execute: true,
          databaseName: "humanity_union_production",
          allowFlag: "true",
          platformMode: "staging",
          nodeEnv: "staging",
          stagingDatabase: "humanity_union_staging",
          allowEnvName: "ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION",
        }),
      /database must be humanity_union_staging/,
    );
  });

  it("M. missing staging env gate => refused", () => {
    assert.throws(
      () =>
        assertExplicitPostFixExecuteGuards({
          mongoFlag: true,
          execute: true,
          databaseName: "humanity_union_staging",
          allowFlag: undefined,
          platformMode: "staging",
          nodeEnv: "staging",
          stagingDatabase: "humanity_union_staging",
          allowEnvName: "ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION",
        }),
      /ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION/,
    );
  });

  it("N. exactly selected identities scheduled (3 override + 1 payload)", async () => {
    const hist: Initiative[] = [];
    for (const suffix of ["h1", "h2", "h3"] as const) {
      const initiative = sampleInitiative(suffix);
      createInitiative(initiative);
      createdInitiativeIds.push(initiative.initiativeId);
      hist.push(initiative);
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "operator_residual_retry",
        targetLocales: ["uk"],
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        historicalCollapsedMeta({
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        }),
      );
    }
    const payload = sampleInitiative("payload");
    createInitiative(payload);
    createdInitiativeIds.push(payload.initiativeId);
    const payloadEnqueue = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: payload.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["zh-Hant"],
    });
    assert.ok(payloadEnqueue.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      payloadEnqueue.eventId,
      modernExactMeta({
        sourceRecordId: payload.initiativeId,
        targetLocale: "zh-Hant",
        failureClass: "PROVIDER_INVALID_RESPONSE",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      }),
    );

    const noise = sampleInitiative("noise");
    createInitiative(noise);
    createdInitiativeIds.push(noise.initiativeId);
    const noiseEnqueue = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: noise.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["ar"],
    });
    assert.ok(noiseEnqueue.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      noiseEnqueue.eventId,
      modernExactMeta({
        sourceRecordId: noise.initiativeId,
        targetLocale: "ar",
        failureReasonCode: "EMPTY_TRANSLATION",
      }),
    );

    const explicit = [
      ...hist.map((initiative) => ({
        sourceKind: "initiative" as const,
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk" as const,
      })),
      {
        sourceKind: "initiative" as const,
        sourceRecordId: payload.initiativeId,
        targetLocale: "zh-Hant" as const,
      },
    ];

    const plan = await runExplicitResidualsAfterFailureReasonFix({
      execute: false,
      postFixFlagEnabled: true,
      explicitIdentities: explicit,
    });
    assert.equal(plan.SELECTED_IDENTITIES, 4);
    assert.equal(
      plan.selectedIdentities.filter(
        (row) => row.selectionPath === "post_fix_diagnostic_override",
      ).length,
      3,
    );
    assert.equal(
      plan.selectedIdentities.filter(
        (row) => row.selectionPath === "normal_invalid_provider_payload",
      ).length,
      1,
    );
    assert.ok(!plan.selectedIdentities.some((row) => row.sourceRecordId === noise.initiativeId));
  });

  it("O. worker concurrency remains bounded", () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    const script = readApi("src/modules/language/public-localization-explicit-post-fix-retry.ts");
    assert.match(script, /WORKER_CONCURRENCY/);
    assert.doesNotMatch(script, /discoverPublicLocalizationCorpus\(/);
  });

  it("P. new failure persists exact reason, never VALIDATION_FAILED reasonCode", async () => {
    const initiative = sampleInitiative("exact-fail");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const hist = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      requestedAt: "2026-09-01T00:00:00.000Z",
    });
    assert.ok(hist.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      hist.eventId,
      historicalCollapsedMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );

    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => ({
        title: initiative.title,
        description: initiative.description,
      })),
    );

    const executed = await runExplicitResidualsAfterFailureReasonFix({
      execute: true,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
      waitForMaterialization: true,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
      processMemoryQueueForTests: drainMemoryWarmQueueSoft,
    });
    assert.equal(executed.SELECTED_IDENTITIES, 1);
    assert.equal(executed.outcomes?.[0]?.outcome, "TERMINAL_FAILED");
    assert.notEqual(executed.outcomes?.[0]?.failureReasonCode, "VALIDATION_FAILED");
    assert.equal(executed.outcomes?.[0]?.failureReasonCode, "UNCHANGED_SOURCE_PROSE");
    assert.equal(
      executed.outcomes?.[0]?.architectureRetryBasis,
      CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
    );
  });

  it("Q. success becomes CURRENT", async () => {
    const initiative = sampleInitiative("success");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const hist = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      requestedAt: "2026-09-01T00:00:00.000Z",
    });
    assert.ok(hist.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      hist.eventId,
      historicalCollapsedMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );

    setTranslationProviderForTests(new DeterministicTranslationProvider());
    const executed = await runExplicitResidualsAfterFailureReasonFix({
      execute: true,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
      waitForMaterialization: true,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
      processMemoryQueueForTests: drainMemoryWarmQueueSoft,
    });
    assert.equal(executed.outcomes?.[0]?.outcome, "CURRENT");
  });

  it("R. no historical failure deletion/clear", async () => {
    const initiative = sampleInitiative("keep-hist");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const hist = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      requestedAt: "2026-09-01T00:00:00.000Z",
    });
    assert.ok(hist.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      hist.eventId,
      historicalCollapsedMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
      }),
    );

    await runExplicitResidualsAfterFailureReasonFix({
      execute: true,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });

    const attempts = await listContentTranslationWarmAttemptsBounded({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      limit: 10,
    });
    assert.ok(attempts.some((row) => row.eventId === hist.eventId && row.status === "failed"));
    assert.ok(
      attempts.some(
        (row) =>
          row.architectureRetryBasis ===
          CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
      ),
    );
  });

  it("S. no unrelated identity touched", async () => {
    const target = sampleInitiative("target");
    const other = sampleInitiative("other");
    createInitiative(target);
    createInitiative(other);
    createdInitiativeIds.push(target.initiativeId, other.initiativeId);
    for (const initiative of [target, other]) {
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "operator_residual_retry",
        targetLocales: ["uk"],
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        historicalCollapsedMeta({
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        }),
      );
    }

    const executed = await runExplicitResidualsAfterFailureReasonFix({
      execute: true,
      postFixFlagEnabled: true,
      explicitIdentities: [
        {
          sourceKind: "initiative",
          sourceRecordId: target.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(executed.SELECTED_IDENTITIES, 1);
    assert.equal(executed.selectedIdentities[0]?.sourceRecordId, target.initiativeId);
    const otherAttempts = await listContentTranslationWarmAttemptsBounded({
      sourceKind: "initiative",
      sourceRecordId: other.initiativeId,
      limit: 10,
    });
    assert.ok(
      !otherAttempts.some(
        (row) =>
          row.architectureRetryBasis ===
          CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
      ),
    );
  });

  it("T. no full bootstrap/hydration", () => {
    const moduleSource = readApi(
      "src/modules/language/public-localization-explicit-post-fix-retry.ts",
    );
    assert.doesNotMatch(moduleSource, /discoverPublicLocalizationCorpus\(/);
    assert.doesNotMatch(moduleSource, /auditPublicLocalizationCorpus\(/);
    assert.doesNotMatch(moduleSource, /bootstrapContentTranslationOperatorPersistence\(/);
    assert.match(moduleSource, /explainResidualsOnly/);
    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /retry-explicit-residuals-after-failure-reason-fix/);
    assert.match(script, /bootstrapContentTranslationResidualDiagnosticPersistence/);
  });

  it("U. 08K.2.5 exact-reason encode invariant still holds", () => {
    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: "VALIDATION_FAILED",
      sourceKind: "initiative",
      sourceRecordId: "x",
      sourceVersion: "v1",
      targetLocale: "uk",
      failedAt: new Date().toISOString(),
      retryabilityHint: "non_retryable_until_code_or_content_change",
    });
    assert.equal(
      parseContentTranslationFailureMetadata(encoded)?.failureReasonCode,
      "OTHER_VALIDATION_FAILURE",
    );
  });

  it("selection requires --residual (no auto discovery)", async () => {
    const plan = await runExplicitResidualsAfterFailureReasonFix({
      execute: false,
      postFixFlagEnabled: true,
      explicitIdentities: [],
    });
    assert.match(plan.abortReason ?? "", /--residual/);
    assert.equal(plan.FULL_CORPUS_HYDRATED, false);
  });
});
