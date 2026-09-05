/**
 * Pack 08K.2.6 — controlled one-attempt post-fix diagnostic retry.
 *
 * Narrow override for historical pre-08K.2.5 collapsed
 * failureReasonCode=VALIDATION_FAILED on explicit --residual identities only.
 * Also selects INVALID_PROVIDER_PAYLOAD under the normal modern retry policy.
 *
 * Never hydrates the full PublicLocalizedPresentation corpus.
 * Never clears historical FAILED outbox rows.
 */

import type {
  ContentTranslationSourceKind,
  LanguageCode,
} from "@hu/types";

import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  isExplicitlyRetryableModernFailure,
  type ContentTranslationArchitectureRetryBasis,
} from "./content-translation-failure-metadata.js";
import {
  enqueueContentTranslationWarmRequested,
  listContentTranslationWarmAttemptsBounded,
  peekContentTranslationWarmOutboxFailure,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import { resolveContentTranslationWarmLocaleConcurrency } from "./content-translation-warm-concurrency.js";
import { resolveContentTranslationWorkerConcurrency } from "./content-translation-worker-concurrency.js";
import { findContentTranslation } from "./persistence/content-translation.repository.js";
import {
  explainResidualsOnly,
  type ResidualDiagnosticIdentity,
} from "./public-localization-residual-only-diagnostic.js";
import type { PublicLocalizationResidualWithPreflight } from "./public-localization-retry-preflight.js";
import type { PublicLocalizationWorkItem } from "./public-localization-corpus.js";
import {
  getResidualDiagnosticCounters,
  loadTranslatableSourceDirect,
  resetResidualDiagnosticCountersForTests,
} from "./content-translation-source-direct.js";

export const EXPLICIT_POST_FIX_RETRY_FLAG =
  "--retry-explicit-residuals-after-failure-reason-fix" as const;

export type ExplicitPostFixRetryEligibility = {
  readonly eligible: boolean;
  readonly architectureRetryBasis: ContentTranslationArchitectureRetryBasis | null;
  readonly blockReason: string | null;
  readonly selectionPath:
    | "post_fix_diagnostic_override"
    | "normal_invalid_provider_payload"
    | "ineligible";
};

function attemptUsesExactFailureReasonPropagationBasis(attempt: {
  readonly architectureRetryBasis: string | null;
  readonly reason: string | null;
}): boolean {
  const basis = CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25;
  if (attempt.architectureRetryBasis === basis) {
    return true;
  }
  if (attempt.reason === basis) {
    return true;
  }
  return false;
}

/**
 * Pure eligibility for Pack 08K.2.6 post-fix diagnostic retry.
 * Does not mutate state. Requires the operator flag to be enabled by caller.
 */
export function evaluateExplicitPostFixDiagnosticRetryEligibility(input: {
  readonly residual: PublicLocalizationResidualWithPreflight;
  readonly postFixFlagEnabled: boolean;
  readonly identityExplicitlySupplied: boolean;
  readonly hasExactFailureReasonPropagationAttempt: boolean;
}): ExplicitPostFixRetryEligibility {
  if (!input.postFixFlagEnabled) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Post-fix diagnostic retry flag is not enabled.",
      selectionPath: "ineligible",
    };
  }
  if (!input.identityExplicitlySupplied) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Identity was not supplied via --residual.",
      selectionPath: "ineligible",
    };
  }

  const row = input.residual;
  const preflight = row.retryPreflight;

  if (preflight.readyState === "CURRENT" || !preflight.currentTranslationAbsent) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "CURRENT translation already exists for live sourceVersion.",
      selectionPath: "ineligible",
    };
  }
  if (!preflight.activeWorkAbsent || preflight.readyState === "ACTIVE_WORK") {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Active queued/processing warm work exists.",
      selectionPath: "ineligible",
    };
  }
  if (!preflight.sourceResolvable) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Source loader did not resolve a public presentation.",
      selectionPath: "ineligible",
    };
  }
  if (!preflight.presentationValid) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Presentation failed eligibility/fingerprint preflight.",
      selectionPath: "ineligible",
    };
  }
  if (!preflight.localeEligible) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason: "Target locale is not enabled for content translation.",
      selectionPath: "ineligible",
    };
  }

  // Normal modern policy — INVALID_PROVIDER_PAYLOAD / SOURCE_UNAVAILABLE.
  if (
    isExplicitlyRetryableModernFailure({
      failureClass: row.failureClass,
      failureReasonCode: row.failureReasonCode,
    })
  ) {
    return {
      eligible: true,
      architectureRetryBasis:
        CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.VALIDATION_DIAGNOSTICS_CONTRACT_v1,
      blockReason: null,
      selectionPath: "normal_invalid_provider_payload",
    };
  }

  // One-time post-fix override — historical collapsed VALIDATION_FAILED only.
  const isHistoricalCollapsed =
    row.translationState === "TERMINAL_FAILED" &&
    row.failureMetadataVersion === "content_translation_failure_meta_v1" &&
    row.failureClass === "VALIDATION_FAILED" &&
    row.failureReasonCode === "VALIDATION_FAILED";

  if (!isHistoricalCollapsed) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason:
        row.failureReasonCode && row.failureReasonCode !== "VALIDATION_FAILED"
          ? `Modern exact failureReasonCode=${row.failureReasonCode} is not eligible for post-fix override.`
          : "Identity does not match historical collapsed VALIDATION_FAILED contract.",
      selectionPath: "ineligible",
    };
  }

  if (input.hasExactFailureReasonPropagationAttempt) {
    return {
      eligible: false,
      architectureRetryBasis: null,
      blockReason:
        "EXACT_FAILURE_REASON_PROPAGATION_08K25 already attempted — one-time override consumed.",
      selectionPath: "ineligible",
    };
  }

  return {
    eligible: true,
    architectureRetryBasis:
      CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.EXACT_FAILURE_REASON_PROPAGATION_08K25,
    blockReason: null,
    selectionPath: "post_fix_diagnostic_override",
  };
}

export type ExplicitPostFixSelectedIdentity = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly architectureRetryBasis: ContentTranslationArchitectureRetryBasis;
  readonly failureReasonCode: string | null;
  readonly selectionPath: ExplicitPostFixRetryEligibility["selectionPath"];
};

export type ExplicitPostFixIdentityOutcome = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
  readonly outcome: "CURRENT" | "TERMINAL_FAILED" | "TIMED_OUT";
  readonly failureMetadataVersion: string | null;
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryability: string | null;
  readonly latestAttemptAt: string | null;
  readonly latestAttemptReason: string | null;
  readonly latestAttemptTargetLocale: string | null;
  readonly architectureRetryBasis: string | null;
};

export type ExplicitPostFixRetryResult = {
  readonly mode: "dry-run" | "execute";
  readonly FULL_CORPUS_HYDRATED: false;
  readonly SELECTED_IDENTITIES: number;
  readonly BLOCKED_IDENTITIES: number;
  readonly SOURCE_RECORDS_LOADED: number;
  readonly PEAK_IN_FLIGHT_IDENTITIES: number;
  readonly WORKER_CONCURRENCY: number;
  readonly selectedIdentities: readonly ExplicitPostFixSelectedIdentity[];
  readonly blockedIdentities: readonly {
    readonly sourceKind: string;
    readonly sourceRecordId: string;
    readonly targetLocale: LanguageCode;
    readonly blockReason: string | null;
    readonly failureReasonCode: string | null;
  }[];
  readonly selectedWorkItems: readonly PublicLocalizationWorkItem[];
  readonly presentationsScheduled: number;
  readonly presentationsDeduped: number;
  readonly presentationsFailed: number;
  readonly enqueueResults: readonly ContentTranslationWarmEnqueueResult[];
  readonly outcomes: readonly ExplicitPostFixIdentityOutcome[] | null;
  readonly abortReason: string | null;
  readonly note: string;
};

async function hasExactFailureReasonPropagationAttempt(identity: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLocale: LanguageCode;
}): Promise<boolean> {
  const attempts = await listContentTranslationWarmAttemptsBounded({
    sourceKind: identity.sourceKind,
    sourceRecordId: identity.sourceRecordId,
    limit: 10,
  });
  return attempts.some((attempt) => {
    if (!attemptUsesExactFailureReasonPropagationBasis(attempt)) {
      return false;
    }
    if (!attempt.targetLocales || attempt.targetLocales.length === 0) {
      return true;
    }
    return attempt.targetLocales.includes(identity.targetLocale);
  });
}

/**
 * Select and optionally enqueue explicit residual identities under Pack 08K.2.6.
 * Requires non-empty explicitIdentities — never discovers from corpus/outbox history.
 */
export async function runExplicitResidualsAfterFailureReasonFix(input: {
  readonly execute: boolean;
  readonly postFixFlagEnabled: boolean;
  readonly explicitIdentities: readonly ResidualDiagnosticIdentity[];
  /** When true, wait for selected identities after enqueue (execute only). */
  readonly waitForMaterialization?: boolean;
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  /** Test hook — process pending memory queue after enqueue. */
  readonly processMemoryQueueForTests?: () => Promise<void>;
}): Promise<ExplicitPostFixRetryResult> {
  resetResidualDiagnosticCountersForTests();

  if (!input.postFixFlagEnabled) {
    return {
      mode: input.execute ? "execute" : "dry-run",
      FULL_CORPUS_HYDRATED: false,
      SELECTED_IDENTITIES: 0,
      BLOCKED_IDENTITIES: 0,
      SOURCE_RECORDS_LOADED: 0,
      PEAK_IN_FLIGHT_IDENTITIES: 0,
      WORKER_CONCURRENCY: resolveContentTranslationWorkerConcurrency(),
      selectedIdentities: [],
      blockedIdentities: [],
      selectedWorkItems: [],
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      outcomes: null,
      abortReason: "ABORT: post-fix diagnostic retry flag is required.",
      note: "Flag gate failed — zero writes.",
    };
  }

  if (!input.explicitIdentities.length) {
    return {
      mode: input.execute ? "execute" : "dry-run",
      FULL_CORPUS_HYDRATED: false,
      SELECTED_IDENTITIES: 0,
      BLOCKED_IDENTITIES: 0,
      SOURCE_RECORDS_LOADED: 0,
      PEAK_IN_FLIGHT_IDENTITIES: 0,
      WORKER_CONCURRENCY: resolveContentTranslationWorkerConcurrency(),
      selectedIdentities: [],
      blockedIdentities: [],
      selectedWorkItems: [],
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      outcomes: null,
      abortReason:
        "ABORT: --residual identities are mandatory for post-fix diagnostic retry.",
      note: "No automatic discovery — explicit identities required.",
    };
  }

  const explained = await explainResidualsOnly({
    explicitIdentities: input.explicitIdentities,
  });

  const selected: ExplicitPostFixSelectedIdentity[] = [];
  const blocked: Array<{
    sourceKind: string;
    sourceRecordId: string;
    targetLocale: LanguageCode;
    blockReason: string | null;
    failureReasonCode: string | null;
  }> = [];
  const selectedWorkItems: PublicLocalizationWorkItem[] = [];

  for (const identity of input.explicitIdentities) {
    const residual =
      explained.residuals.find(
        (row) =>
          row.presentationIdentity.sourceKind === identity.sourceKind &&
          row.presentationIdentity.sourceRecordId === identity.sourceRecordId &&
          row.targetLocale === identity.targetLocale,
      ) ?? null;

    if (!residual) {
      blocked.push({
        sourceKind: identity.sourceKind,
        sourceRecordId: identity.sourceRecordId,
        targetLocale: identity.targetLocale,
        blockReason:
          "Identity is not a true residual (CURRENT or non-terminal) after live compact check.",
        failureReasonCode: null,
      });
      continue;
    }

    const alreadyAttempted = await hasExactFailureReasonPropagationAttempt(identity);
    const eligibility = evaluateExplicitPostFixDiagnosticRetryEligibility({
      residual,
      postFixFlagEnabled: true,
      identityExplicitlySupplied: true,
      hasExactFailureReasonPropagationAttempt: alreadyAttempted,
    });

    if (!eligibility.eligible || !eligibility.architectureRetryBasis) {
      blocked.push({
        sourceKind: identity.sourceKind,
        sourceRecordId: identity.sourceRecordId,
        targetLocale: identity.targetLocale,
        blockReason: eligibility.blockReason,
        failureReasonCode: residual.failureReasonCode,
      });
      continue;
    }

    selected.push({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
      targetLocale: identity.targetLocale,
      architectureRetryBasis: eligibility.architectureRetryBasis,
      failureReasonCode: residual.failureReasonCode,
      selectionPath: eligibility.selectionPath,
    });

    let sourceVersion = "unloaded";
    try {
      const source = await loadTranslatableSourceDirect({
        sourceKind: identity.sourceKind,
        sourceRecordId: identity.sourceRecordId,
      });
      if (source) {
        sourceVersion = source.sourceVersion;
      }
    } catch {
      sourceVersion = "unloaded";
    }

    selectedWorkItems.push({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
      sourceVersion,
      targetLanguage: identity.targetLocale,
      state: "FAILED",
      autoNodeCount: 0,
      missingOrStaleNodeCount: 0,
      fallbackPaths: [],
    });
  }

  const counters = getResidualDiagnosticCounters();
  const workerConcurrency = resolveContentTranslationWorkerConcurrency();
  const localeConcurrency = resolveContentTranslationWarmLocaleConcurrency();

  const baseNote =
    "Pack 08K.2.6 explicit post-fix diagnostic retry — no full corpus hydrate; historical FAILED rows not cleared.";

  if (!input.execute) {
    return {
      mode: "dry-run",
      FULL_CORPUS_HYDRATED: false,
      SELECTED_IDENTITIES: selected.length,
      BLOCKED_IDENTITIES: blocked.length,
      SOURCE_RECORDS_LOADED: counters.SOURCE_RECORDS_LOADED,
      PEAK_IN_FLIGHT_IDENTITIES: Math.min(
        counters.PEAK_IN_FLIGHT_IDENTITIES,
        localeConcurrency,
      ),
      WORKER_CONCURRENCY: workerConcurrency,
      selectedIdentities: selected,
      blockedIdentities: blocked,
      selectedWorkItems,
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      outcomes: null,
      abortReason: null,
      note: `${baseNote} DRY RUN — zero writes.`,
    };
  }

  const byPresentation = new Map<
    string,
    {
      sourceKind: ContentTranslationSourceKind;
      sourceRecordId: string;
      targetLocales: LanguageCode[];
      architectureRetryBasis: ContentTranslationArchitectureRetryBasis;
    }
  >();
  for (const row of selected) {
    const key = `${row.sourceKind}::${row.sourceRecordId}::${row.architectureRetryBasis}`;
    const existing = byPresentation.get(key);
    if (existing) {
      if (!existing.targetLocales.includes(row.targetLocale)) {
        existing.targetLocales.push(row.targetLocale);
      }
      continue;
    }
    byPresentation.set(key, {
      sourceKind: row.sourceKind,
      sourceRecordId: row.sourceRecordId,
      targetLocales: [row.targetLocale],
      architectureRetryBasis: row.architectureRetryBasis,
    });
  }

  const enqueueResults: ContentTranslationWarmEnqueueResult[] = [];
  let presentationsScheduled = 0;
  let presentationsDeduped = 0;
  let presentationsFailed = 0;

  for (const unit of byPresentation.values()) {
    try {
      const result = await enqueueContentTranslationWarmRequested({
        sourceKind: unit.sourceKind,
        sourceRecordId: unit.sourceRecordId,
        reason: "operator_residual_retry",
        targetLocales: unit.targetLocales,
        architectureRetryBasis: unit.architectureRetryBasis,
      });
      enqueueResults.push(result);
      if (result.enqueued) {
        presentationsScheduled += 1;
      } else if (result.deduped) {
        presentationsDeduped += 1;
      } else {
        presentationsFailed += 1;
      }
    } catch {
      presentationsFailed += 1;
    }
  }

  if (input.processMemoryQueueForTests) {
    await input.processMemoryQueueForTests();
  }

  let outcomes: ExplicitPostFixIdentityOutcome[] | null = null;
  if (input.waitForMaterialization) {
    outcomes = await waitForExplicitPostFixOutcomes({
      selected,
      selectedWorkItems,
      timeoutMs: input.timeoutMs ?? 120_000,
      pollIntervalMs: input.pollIntervalMs ?? 50,
    });
  }

  return {
    mode: "execute",
    FULL_CORPUS_HYDRATED: false,
    SELECTED_IDENTITIES: selected.length,
    BLOCKED_IDENTITIES: blocked.length,
    SOURCE_RECORDS_LOADED: counters.SOURCE_RECORDS_LOADED,
    PEAK_IN_FLIGHT_IDENTITIES: Math.min(
      Math.max(counters.PEAK_IN_FLIGHT_IDENTITIES, selected.length > 0 ? 1 : 0),
      localeConcurrency,
    ),
    WORKER_CONCURRENCY: workerConcurrency,
    selectedIdentities: selected,
    blockedIdentities: blocked,
    selectedWorkItems,
    presentationsScheduled,
    presentationsDeduped,
    presentationsFailed,
    enqueueResults,
    outcomes,
    abortReason: null,
    note: baseNote,
  };
}

async function waitForExplicitPostFixOutcomes(input: {
  readonly selected: readonly ExplicitPostFixSelectedIdentity[];
  readonly selectedWorkItems: readonly PublicLocalizationWorkItem[];
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
}): Promise<ExplicitPostFixIdentityOutcome[]> {
  const started = Date.now();
  const versionByKey = new Map(
    input.selectedWorkItems.map((item) => [
      `${item.sourceKind}::${item.sourceRecordId}::${item.targetLanguage}`,
      item.sourceVersion,
    ]),
  );

  for (;;) {
    const outcomes: ExplicitPostFixIdentityOutcome[] = [];
    let unresolved = 0;

    for (const row of input.selected) {
      const key = `${row.sourceKind}::${row.sourceRecordId}::${row.targetLocale}`;
      const sourceVersion = versionByKey.get(key) ?? "unloaded";
      const peek = await peekContentTranslationWarmOutboxFailure({
        sourceKind: row.sourceKind,
        sourceRecordId: row.sourceRecordId,
        targetLocale: row.targetLocale,
      });

      let outcome: ExplicitPostFixIdentityOutcome["outcome"] = "TIMED_OUT";
      if (sourceVersion !== "unloaded") {
        const translation = await findContentTranslation({
          sourceKind: row.sourceKind,
          sourceRecordId: row.sourceRecordId,
          sourceVersion,
          targetLanguage: row.targetLocale,
        });
        if (translation && translation.freshness === "current" && translation.stale !== true) {
          outcome = "CURRENT";
        } else if (peek.disposition === "failed") {
          outcome = "TERMINAL_FAILED";
        } else if (peek.disposition === "pending" || peek.disposition === "published") {
          unresolved += 1;
          outcome = "TIMED_OUT";
        } else {
          unresolved += 1;
          outcome = "TIMED_OUT";
        }
      } else if (peek.disposition === "failed") {
        outcome = "TERMINAL_FAILED";
      } else {
        unresolved += 1;
      }

      const meta = peek.failureMetadata;
      outcomes.push({
        sourceKind: row.sourceKind,
        sourceRecordId: row.sourceRecordId,
        targetLocale: row.targetLocale,
        outcome,
        failureMetadataVersion: meta
          ? meta.schema
          : peek.disposition === "failed"
            ? "legacy_unstructured"
            : null,
        failureClass: meta?.failureClass ?? null,
        failureReasonCode: meta?.failureReasonCode ?? null,
        retryability: meta?.retryabilityHint ?? null,
        latestAttemptAt: peek.latestAttempt?.attemptAt ?? peek.lastFailureAt,
        latestAttemptReason: peek.latestAttempt?.reason ?? null,
        latestAttemptTargetLocale: row.targetLocale,
        architectureRetryBasis: peek.latestAttempt?.architectureRetryBasis ?? null,
      });
    }

    if (unresolved === 0) {
      return outcomes;
    }
    if (Date.now() - started >= input.timeoutMs) {
      return outcomes.map((row) =>
        row.outcome === "CURRENT" || row.outcome === "TERMINAL_FAILED"
          ? row
          : { ...row, outcome: "TIMED_OUT" as const },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, input.pollIntervalMs));
  }
}

/** Script/contract helpers for production/DB gate tests. */
export function assertExplicitPostFixExecuteGuards(input: {
  readonly mongoFlag: boolean;
  readonly execute: boolean;
  readonly databaseName: string | null;
  readonly allowFlag: string | undefined;
  readonly platformMode: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly stagingDatabase: string;
  readonly allowEnvName: string;
}): void {
  if (!input.execute) {
    return;
  }
  if (!input.mongoFlag) {
    throw new Error(
      "Refusing post-fix diagnostic retry execute: --mongo is required with --execute.",
    );
  }
  if (input.allowFlag !== "true") {
    throw new Error(
      `Refusing execute: set ${input.allowEnvName}=true to confirm staging public localization reconciliation.`,
    );
  }
  if (input.databaseName !== input.stagingDatabase) {
    throw new Error(
      `Refusing execute: database must be ${input.stagingDatabase} (got ${input.databaseName ?? "unset"}).`,
    );
  }
  const platformMode = (input.platformMode ?? "").trim().toLowerCase();
  if (platformMode === "production") {
    throw new Error("Refusing execute: PLATFORM_MODE=production is not allowed.");
  }
  const nodeEnv = (input.nodeEnv ?? "").trim().toLowerCase();
  if (nodeEnv === "production" && platformMode !== "staging") {
    throw new Error(
      "Refusing execute: NODE_ENV=production without PLATFORM_MODE=staging.",
    );
  }
}
