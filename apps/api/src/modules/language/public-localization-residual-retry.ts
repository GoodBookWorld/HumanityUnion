/**
 * Pack 08K.2.2 — gated residual localization retry operator.
 *
 * Selects work exclusively via retry preflight (ready === true).
 * Never falls back to full-corpus reconciliation selection.
 * Locale-precise: enqueue carries targetLocales for ready identities only.
 *
 * Dry-run default: zero provider calls, zero writes.
 * Execute: enqueue only — materialization requires live outbox consumer.
 */

import type { LanguageCode } from "@hu/types";

import {
  enqueueContentTranslationWarmRequested,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import type { StagingWarmDiscoveryDeps, StagingWarmSourceKind } from "./content-translation-staging-warm-backfill.js";
import {
  auditPublicLocalizationCorpus,
  discoverPublicLocalizationCorpus,
  type PublicLocalizationCorpusAudit,
  type PublicLocalizationWorkItem,
} from "./public-localization-corpus.js";
import {
  explainPublicLocalizationResidualsWithPreflight,
  selectReadyPresentationsForResidualRetry,
  selectedReadyWorkItemsFromResiduals,
  type PublicLocalizationResidualWithPreflight,
  type PublicLocalizationRetrySelection,
  type ResidualRetryPresentationSchedule,
} from "./public-localization-retry-preflight.js";
import { loadTranslatableSource } from "./content-translation.service.js";

export type PublicLocalizationResidualRetryMode = "dry-run" | "execute";

export type PublicLocalizationResidualRetryResult = {
  readonly mode: PublicLocalizationResidualRetryMode;
  /** Pre-execution corpus audit (not post-materialization). */
  readonly preAudit: PublicLocalizationCorpusAudit;
  readonly selection: PublicLocalizationRetrySelection;
  readonly RETRY_READY_IDENTITIES: number;
  readonly RETRY_BLOCKED_IDENTITIES: number;
  readonly RETRY_SELECTED_IDENTITIES: number;
  readonly selectedIdentities: readonly {
    readonly family: string;
    readonly sourceRecordId: string;
    readonly targetLocale: LanguageCode;
    readonly architectureRetryBasis: string | null;
    readonly failureReasonCode: string | null;
  }[];
  readonly blockedIdentities: readonly {
    readonly family: string;
    readonly sourceRecordId: string;
    readonly targetLocale: LanguageCode;
    readonly blockReason: string | null;
    readonly failureReasonCode: string | null;
  }[];
  readonly schedule: readonly ResidualRetryPresentationSchedule[];
  /** Presentation enqueue count may be < selected identities (locale grouping). */
  readonly presentationsToEnqueue: number;
  readonly presentationGroupingExplained: boolean;
  readonly selectedWorkItems: readonly PublicLocalizationWorkItem[];
  readonly presentationsScheduled: number;
  readonly presentationsDeduped: number;
  readonly presentationsFailed: number;
  readonly enqueueResults: readonly ContentTranslationWarmEnqueueResult[];
  readonly abortReason: string | null;
};

function summarizeIdentity(row: PublicLocalizationResidualWithPreflight) {
  return {
    family: row.family,
    sourceRecordId: row.presentationIdentity.sourceRecordId,
    targetLocale: row.targetLocale,
    architectureRetryBasis: row.retryPreflight.architectureRetryBasis,
    failureReasonCode: row.failureReasonCode,
  };
}

function summarizeBlocked(row: PublicLocalizationResidualWithPreflight) {
  return {
    family: row.family,
    sourceRecordId: row.presentationIdentity.sourceRecordId,
    targetLocale: row.targetLocale,
    blockReason: row.retryPreflight.blockReason,
    failureReasonCode: row.failureReasonCode,
  };
}

/**
 * Recompute preflight and (optionally) enqueue only ready residual identities.
 * Selection is exclusive to retry-ready identities (no full-corpus enqueue helper).
 */
export async function runPublicLocalizationResidualRetry(input: {
  readonly execute: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
  readonly targetLocales?: readonly LanguageCode[];
}): Promise<PublicLocalizationResidualRetryResult> {
  const discovery = await discoverPublicLocalizationCorpus({
    kinds: input.kinds,
    deps: input.deps,
  });

  const preAudit = await auditPublicLocalizationCorpus({
    kinds: input.kinds,
    deps: input.deps,
    targetLocales: input.targetLocales,
    discovery,
  });

  // Immediate preflight recompute (authoritative selection gate).
  const explained = await explainPublicLocalizationResidualsWithPreflight({
    workItems: preAudit.workItems,
  });

  const ready = explained.selection.ready.filter((row) => row.retryPreflight.ready);
  const blocked = explained.selection.blocked;

  // Defend against any non-ready sneaking into ready[].
  const selected = ready.filter((row) => row.retryPreflight.ready === true);
  if (selected.length !== ready.length) {
    return {
      mode: input.execute ? "execute" : "dry-run",
      preAudit,
      selection: explained.selection,
      RETRY_READY_IDENTITIES: ready.length,
      RETRY_BLOCKED_IDENTITIES: blocked.length,
      RETRY_SELECTED_IDENTITIES: 0,
      selectedIdentities: [],
      blockedIdentities: blocked.map(summarizeBlocked),
      schedule: [],
      presentationsToEnqueue: 0,
      presentationGroupingExplained: false,
      selectedWorkItems: [],
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      abortReason:
        "ABORT: selected identities diverge from ready filter before enqueue (integrity).",
    };
  }

  const schedule = selectReadyPresentationsForResidualRetry({
    ...explained.selection,
    ready: selected,
  });

  const identityCountFromSchedule = schedule.reduce(
    (sum, unit) => sum + unit.readyIdentityCount,
    0,
  );
  const presentationGroupingExplained =
    schedule.length !== selected.length && identityCountFromSchedule === selected.length;

  if (identityCountFromSchedule !== selected.length) {
    return {
      mode: input.execute ? "execute" : "dry-run",
      preAudit,
      selection: explained.selection,
      RETRY_READY_IDENTITIES: selected.length,
      RETRY_BLOCKED_IDENTITIES: blocked.length,
      RETRY_SELECTED_IDENTITIES: 0,
      selectedIdentities: [],
      blockedIdentities: blocked.map(summarizeBlocked),
      schedule,
      presentationsToEnqueue: schedule.length,
      presentationGroupingExplained: false,
      selectedWorkItems: [],
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      abortReason:
        "ABORT: presentation locale grouping lost identities (selected != ready after dedupe).",
    };
  }

  // Resolve live sourceVersion for wait identities (truthful CURRENT matching).
  const selectedWorkItems: PublicLocalizationWorkItem[] = [];
  for (const row of selected) {
    let sourceVersion = "unloaded";
    try {
      const source = await loadTranslatableSource({
        sourceKind: row.presentationIdentity.sourceKind as PublicLocalizationWorkItem["sourceKind"],
        sourceRecordId: row.presentationIdentity.sourceRecordId,
      });
      if (source) {
        sourceVersion = source.sourceVersion;
      }
    } catch {
      sourceVersion = "unloaded";
    }
    selectedWorkItems.push({
      sourceKind: row.presentationIdentity.sourceKind as PublicLocalizationWorkItem["sourceKind"],
      sourceRecordId: row.presentationIdentity.sourceRecordId,
      sourceVersion,
      targetLanguage: row.targetLocale,
      state: "MISSING",
      autoNodeCount: 0,
      missingOrStaleNodeCount: 0,
      fallbackPaths: [],
    });
  }

  const base: Omit<
    PublicLocalizationResidualRetryResult,
    | "mode"
    | "presentationsScheduled"
    | "presentationsDeduped"
    | "presentationsFailed"
    | "enqueueResults"
    | "abortReason"
  > = {
    preAudit,
    selection: explained.selection,
    RETRY_READY_IDENTITIES: selected.length,
    RETRY_BLOCKED_IDENTITIES: blocked.length,
    RETRY_SELECTED_IDENTITIES: selected.length,
    selectedIdentities: selected.map(summarizeIdentity),
    blockedIdentities: blocked.map(summarizeBlocked),
    schedule,
    presentationsToEnqueue: schedule.length,
    presentationGroupingExplained,
    selectedWorkItems,
  };

  if (!input.execute) {
    return {
      ...base,
      mode: "dry-run",
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      presentationsFailed: 0,
      enqueueResults: [],
      abortReason: null,
    };
  }

  // Execute: enqueue presentation units with locale constraints only.
  // Does NOT clear historical FAILED outbox rows globally.
  const enqueueResults: ContentTranslationWarmEnqueueResult[] = [];
  let presentationsScheduled = 0;
  let presentationsDeduped = 0;
  let presentationsFailed = 0;

  for (const unit of schedule) {
    try {
      const result = await enqueueContentTranslationWarmRequested({
        sourceKind: unit.sourceKind,
        sourceRecordId: unit.sourceRecordId,
        reason: "operator_residual_retry",
        targetLocales: unit.targetLocales,
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
    ...base,
    mode: "execute",
    presentationsScheduled,
    presentationsDeduped,
    presentationsFailed,
    enqueueResults,
    abortReason: null,
  };
}

/**
 * Fresh post-materialization corpus audit (never reuse pre-execution snapshot).
 */
export async function auditPublicLocalizationCorpusPostRetry(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
  readonly targetLocales?: readonly LanguageCode[];
}): Promise<PublicLocalizationCorpusAudit> {
  return auditPublicLocalizationCorpus({
    kinds: input?.kinds,
    deps: input?.deps,
    targetLocales: input?.targetLocales,
  });
}

export { selectedReadyWorkItemsFromResiduals, selectReadyPresentationsForResidualRetry };
