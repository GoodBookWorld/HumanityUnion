/**
 * Pack 08K.1 — historical public localization reconciliation operator.
 *
 * Discovers via the SAME PublicLocalizedPresentation corpus as
 * diagnose:public-localization. Dry-run is default (read-only).
 * Execute enqueues through existing bounded warm infrastructure.
 */

import type { LanguageCode } from "@hu/types";

import {
  enqueueContentTranslationWarmRequested,
  resolveContentTranslationWarmOutboxDisposition,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import type { StagingWarmDiscoveryDeps, StagingWarmSourceKind } from "./content-translation-staging-warm-backfill.js";
import {
  findContentTranslation,
} from "./persistence/content-translation.repository.js";
import {
  auditPublicLocalizationCorpus,
  discoverPublicLocalizationCorpus,
  uniquePresentationsRequiringWork,
  type PublicLocalizationCorpusAudit,
  type PublicLocalizationWorkItem,
} from "./public-localization-corpus.js";

export type PublicLocalizationReconciliationMode = "dry-run" | "execute";

export interface PublicLocalizationReconciliationResult {
  readonly mode: PublicLocalizationReconciliationMode;
  readonly audit: PublicLocalizationCorpusAudit;
  readonly presentationsScheduled: number;
  readonly presentationsDeduped: number;
  readonly presentationsFailed: number;
  readonly enqueueResults: readonly ContentTranslationWarmEnqueueResult[];
}

/**
 * Audit (+ optional enqueue) using shared corpus discovery.
 * Dry-run: zero provider calls, zero outbox writes.
 */
export async function runPublicLocalizationReconciliation(input: {
  readonly execute: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
  readonly targetLocales?: readonly LanguageCode[];
}): Promise<PublicLocalizationReconciliationResult> {
  const discovery = await discoverPublicLocalizationCorpus({
    kinds: input.kinds,
    deps: input.deps,
  });

  const audit = await auditPublicLocalizationCorpus({
    kinds: input.kinds,
    deps: input.deps,
    targetLocales: input.targetLocales,
    discovery,
  });

  const toEnqueue = uniquePresentationsRequiringWork(audit.workItems);

  if (!input.execute) {
    return {
      mode: "dry-run",
      audit,
      presentationsScheduled: toEnqueue.length,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
    };
  }

  const enqueueResults: ContentTranslationWarmEnqueueResult[] = [];
  let presentationsScheduled = 0;
  let presentationsDeduped = 0;
  let presentationsFailed = 0;

  // Bound enqueue to unique presentation identities — never Promise.all the
  // full fallback-node set. Locale fan-out stays inside the warm consumer.
  for (const candidate of toEnqueue) {
    try {
      const result = await enqueueContentTranslationWarmRequested({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
        reason: "operator_backfill",
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

  return {
    mode: "execute",
    audit,
    presentationsScheduled,
    presentationsDeduped,
    presentationsFailed,
    enqueueResults,
  };
}

/**
 * Wait for compact work-item identities only.
 * Does not rehydrate sources or call the provider.
 *
 * Pack 08K.2 state model:
 *   CURRENT | QUEUED | PROCESSING | RETRYING | TERMINAL_FAILED |
 *   MISSING_AFTER_DISPATCH | MISSING | TIMED_OUT
 *
 * Never report generic PENDING solely because the operator enqueued earlier
 * when durable evidence shows the outbox was already consumed without a row.
 */
export type PublicLocalizationWaitProgress = {
  readonly WORK_ITEMS_TOTAL: number;
  readonly CURRENT: number;
  readonly QUEUED: number;
  readonly PROCESSING: number;
  readonly RETRYING: number;
  readonly TERMINAL_FAILED: number;
  readonly MISSING_AFTER_DISPATCH: number;
  readonly MISSING: number;
  /** @deprecated Pack 08K.2 — use QUEUED+PROCESSING+MISSING; kept for prior wait JSON */
  readonly PENDING: number;
  readonly TIMED_OUT: number;
};

export type PublicLocalizationMaterializationState =
  | "CURRENT"
  | "QUEUED"
  | "PROCESSING"
  | "RETRYING"
  | "TERMINAL_FAILED"
  | "MISSING_AFTER_DISPATCH"
  | "MISSING"
  | "STALE";

export async function resolvePublicLocalizationMaterializationState(input: {
  readonly workItem: PublicLocalizationWorkItem;
  readonly outboxDisposition: Awaited<
    ReturnType<typeof resolveContentTranslationWarmOutboxDisposition>
  >;
}): Promise<PublicLocalizationMaterializationState> {
  const identity = input.workItem;
  const row = await findContentTranslation({
    sourceKind: identity.sourceKind,
    sourceRecordId: identity.sourceRecordId,
    sourceVersion: identity.sourceVersion,
    targetLanguage: identity.targetLanguage,
  });

  if (row && row.freshness === "current" && row.stale !== true) {
    return "CURRENT";
  }
  if (row && row.freshness === "regenerating") {
    return "RETRYING";
  }
  if (row && (row.stale || row.freshness === "stale")) {
    return "STALE";
  }

  if (input.outboxDisposition === "pending") {
    return "QUEUED";
  }
  if (input.outboxDisposition === "failed") {
    return "TERMINAL_FAILED";
  }
  if (input.outboxDisposition === "published") {
    return "MISSING_AFTER_DISPATCH";
  }
  return "MISSING";
}

export async function waitForPublicLocalizationMaterialization(input: {
  readonly workItems: readonly PublicLocalizationWorkItem[];
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly onProgress?: (progress: PublicLocalizationWaitProgress) => void;
}): Promise<{
  readonly timedOut: boolean;
  readonly elapsedMs: number;
  readonly progress: PublicLocalizationWaitProgress;
}> {
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 120_000);
  const pollIntervalMs = Math.max(250, input.pollIntervalMs ?? 2_000);
  const started = Date.now();

  const identities = input.workItems.filter(
    (item) =>
      item.state === "MISSING" ||
      item.state === "MISSING_AFTER_DISPATCH" ||
      item.state === "STALE" ||
      item.state === "FAILED" ||
      item.state === "QUEUED" ||
      item.state === "PENDING" ||
      item.state === "PROCESSING" ||
      item.state === "RETRYING",
  );

  let lastProgress: PublicLocalizationWaitProgress = {
    WORK_ITEMS_TOTAL: identities.length,
    CURRENT: 0,
    QUEUED: 0,
    PROCESSING: 0,
    RETRYING: 0,
    TERMINAL_FAILED: 0,
    MISSING_AFTER_DISPATCH: 0,
    MISSING: identities.length,
    PENDING: identities.length,
    TIMED_OUT: 0,
  };

  const outboxCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveContentTranslationWarmOutboxDisposition>>
  >();

  async function outboxFor(item: PublicLocalizationWorkItem) {
    const key = `${item.sourceKind}::${item.sourceRecordId}::${item.targetLanguage}`;
    const cached = outboxCache.get(key);
    if (cached) {
      return cached;
    }
    const disposition = await resolveContentTranslationWarmOutboxDisposition({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
      targetLocale: item.targetLanguage,
    });
    outboxCache.set(key, disposition);
    return disposition;
  }

  for (;;) {
    let current = 0;
    let queued = 0;
    let processing = 0;
    let retrying = 0;
    let terminalFailed = 0;
    let missingAfterDispatch = 0;
    let missing = 0;
    outboxCache.clear();

    for (const identity of identities) {
      const disposition = await outboxFor(identity);
      const state = await resolvePublicLocalizationMaterializationState({
        workItem: identity,
        outboxDisposition: disposition,
      });

      switch (state) {
        case "CURRENT":
          current += 1;
          break;
        case "QUEUED":
          queued += 1;
          break;
        case "PROCESSING":
          processing += 1;
          break;
        case "RETRYING":
          retrying += 1;
          break;
        case "TERMINAL_FAILED":
          terminalFailed += 1;
          break;
        case "MISSING_AFTER_DISPATCH":
          missingAfterDispatch += 1;
          break;
        case "STALE":
          missing += 1;
          break;
        default:
          missing += 1;
          break;
      }
    }

    const unresolvedOpen = queued + processing + retrying;
    lastProgress = {
      WORK_ITEMS_TOTAL: identities.length,
      CURRENT: current,
      QUEUED: queued,
      PROCESSING: processing,
      RETRYING: retrying,
      TERMINAL_FAILED: terminalFailed,
      MISSING_AFTER_DISPATCH: missingAfterDispatch,
      MISSING: missing,
      PENDING: unresolvedOpen,
      TIMED_OUT: 0,
    };
    input.onProgress?.(lastProgress);

    if (current === identities.length) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        progress: lastProgress,
      };
    }

    // Converged residual: no durable queued/processing work remains.
    if (unresolvedOpen === 0) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        progress: lastProgress,
      };
    }

    if (Date.now() - started >= timeoutMs) {
      lastProgress = { ...lastProgress, TIMED_OUT: unresolvedOpen };
      input.onProgress?.(lastProgress);
      return {
        timedOut: true,
        elapsedMs: Date.now() - started,
        progress: lastProgress,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

export type PublicLocalizationResidualExplanation = {
  readonly family: string;
  readonly presentationIdentity: {
    readonly sourceKind: string;
    readonly sourceRecordId: string;
  };
  readonly targetLocale: LanguageCode;
  readonly translationState: PublicLocalizationMaterializationState | PublicLocalizationWorkItem["state"];
  readonly sourceVersionMatch: "match" | "mismatch" | "no_row" | "unloaded";
  readonly failureClass: string | null;
  readonly retryability: string | null;
  readonly lastFailureAt: string | null;
  readonly outboxDisposition: string;
  readonly mayScheduleNewWarm: boolean | null;
};

/**
 * READ-ONLY residual explain — zero provider calls / zero writes.
 * Never includes source or translated bodies.
 */
export async function explainPublicLocalizationResiduals(input: {
  readonly workItems: readonly PublicLocalizationWorkItem[];
}): Promise<readonly PublicLocalizationResidualExplanation[]> {
  const { peekContentTranslationWarmOutboxFailure } = await import(
    "./content-translation-warm-enqueue.js"
  );
  const {
    classifyContentTranslationMaterializationFailure,
    resolveContentTranslationFailureRetryPolicy,
  } = await import("./content-translation-warm-failure.js");
  const { TranslationProviderError } = await import("./translation.config.js");

  const out: PublicLocalizationResidualExplanation[] = [];

  for (const item of input.workItems) {
    if (item.state === "CURRENT" || item.state === "MANUAL_PRESERVED") {
      continue;
    }

    const peek = await peekContentTranslationWarmOutboxFailure({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
    });

    const row = item.sourceVersion === "unloaded"
      ? null
      : await findContentTranslation({
          sourceKind: item.sourceKind,
          sourceRecordId: item.sourceRecordId,
          sourceVersion: item.sourceVersion,
          targetLanguage: item.targetLanguage,
        });

    let sourceVersionMatch: PublicLocalizationResidualExplanation["sourceVersionMatch"] =
      "no_row";
    if (item.sourceVersion === "unloaded") {
      sourceVersionMatch = "unloaded";
    } else if (row) {
      sourceVersionMatch =
        row.sourceVersion === item.sourceVersion ? "match" : "mismatch";
    }

    const materializationState = await resolvePublicLocalizationMaterializationState({
      workItem: item,
      outboxDisposition: peek.disposition,
    });

    let failureClass: string | null = peek.lastErrorClass;
    let retryability: string | null = null;
    let mayScheduleNewWarm: boolean | null = null;

    if (materializationState === "MISSING_AFTER_DISPATCH") {
      failureClass = "MISSING_AFTER_DISPATCH";
      const policy = resolveContentTranslationFailureRetryPolicy({
        failureClass: "MISSING_AFTER_DISPATCH",
        liveSourceVersion: item.sourceVersion,
        failedSourceVersion: null,
      });
      retryability = policy.retryability;
      mayScheduleNewWarm = policy.mayScheduleNewWarm;
    } else if (materializationState === "TERMINAL_FAILED" || item.state === "FAILED") {
      if (!failureClass) {
        failureClass = "UNKNOWN";
      }
      // Reconstruct policy from safe class string (no body).
      const synthetic =
        failureClass === "SOURCE_UNAVAILABLE"
          ? new TranslationProviderError("unavailable", "source unavailable")
          : failureClass === "PROVIDER_TIMEOUT"
            ? new TranslationProviderError("timeout", "timeout")
            : failureClass === "VALIDATION_FAILED"
              ? new TranslationProviderError("bad_request", "validation")
              : failureClass === "PROVIDER_INVALID_RESPONSE"
                ? new TranslationProviderError("malformed_response", "malformed")
                : new TranslationProviderError("bad_request", "unknown");
      const classified = classifyContentTranslationMaterializationFailure(synthetic);
      const policy = resolveContentTranslationFailureRetryPolicy({
        failureClass: classified.failureClass,
        liveSourceVersion: item.sourceVersion,
        failedSourceVersion: row?.sourceVersion ?? null,
      });
      failureClass = classified.failureClass;
      retryability = policy.retryability;
      mayScheduleNewWarm = policy.mayScheduleNewWarm;
    } else if (materializationState === "MISSING" || materializationState === "STALE") {
      failureClass = materializationState === "STALE" ? "SOURCE_VERSION_MISMATCH" : null;
      const policy = resolveContentTranslationFailureRetryPolicy({
        failureClass: materializationState === "STALE" ? "SOURCE_VERSION_MISMATCH" : "UNKNOWN",
        liveSourceVersion: item.sourceVersion,
        failedSourceVersion: row?.sourceVersion ?? null,
      });
      retryability = policy.retryability;
      mayScheduleNewWarm = policy.mayScheduleNewWarm;
    }

    out.push({
      family: item.sourceKind,
      presentationIdentity: {
        sourceKind: item.sourceKind,
        sourceRecordId: item.sourceRecordId,
      },
      targetLocale: item.targetLanguage,
      translationState: materializationState,
      sourceVersionMatch,
      failureClass,
      retryability,
      lastFailureAt: peek.lastFailureAt,
      outboxDisposition: peek.disposition,
      mayScheduleNewWarm,
    });
  }

  return out;
}
