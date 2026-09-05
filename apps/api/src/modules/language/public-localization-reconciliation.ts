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

export type PublicLocalizationWaitProgress = {
  readonly WORK_ITEMS_TOTAL: number;
  readonly CURRENT: number;
  readonly PENDING: number;
  readonly RETRYING: number;
  readonly TERMINAL_FAILED: number;
  readonly TIMED_OUT: number;
};

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
 */
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
      item.state === "STALE" ||
      item.state === "FAILED" ||
      item.state === "PENDING",
  );

  let lastProgress: PublicLocalizationWaitProgress = {
    WORK_ITEMS_TOTAL: identities.length,
    CURRENT: 0,
    PENDING: identities.length,
    RETRYING: 0,
    TERMINAL_FAILED: 0,
    TIMED_OUT: 0,
  };

  const outboxCache = new Map<
    string,
    Awaited<ReturnType<typeof resolveContentTranslationWarmOutboxDisposition>>
  >();

  async function outboxFor(item: PublicLocalizationWorkItem) {
    const key = `${item.sourceKind}::${item.sourceRecordId}`;
    const cached = outboxCache.get(key);
    if (cached) {
      return cached;
    }
    const disposition = await resolveContentTranslationWarmOutboxDisposition({
      sourceKind: item.sourceKind,
      sourceRecordId: item.sourceRecordId,
    });
    outboxCache.set(key, disposition);
    return disposition;
  }

  for (;;) {
    let current = 0;
    let pending = 0;
    let retrying = 0;
    let terminalFailed = 0;
    outboxCache.clear();

    for (const identity of identities) {
      const row = await findContentTranslation({
        sourceKind: identity.sourceKind,
        sourceRecordId: identity.sourceRecordId,
        sourceVersion: identity.sourceVersion,
        targetLanguage: identity.targetLanguage,
      });

      if (row && row.freshness === "current" && row.stale !== true) {
        current += 1;
        continue;
      }

      if (row && row.freshness === "regenerating") {
        retrying += 1;
        continue;
      }

      const disposition = await outboxFor(identity);
      if (disposition === "failed") {
        terminalFailed += 1;
      } else if (disposition === "pending") {
        pending += 1;
      } else if (row && (row.stale || row.freshness === "stale")) {
        pending += 1;
      } else {
        pending += 1;
      }
    }

    lastProgress = {
      WORK_ITEMS_TOTAL: identities.length,
      CURRENT: current,
      PENDING: pending,
      RETRYING: retrying,
      TERMINAL_FAILED: terminalFailed,
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

    if (terminalFailed > 0 && pending === 0 && retrying === 0) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        progress: lastProgress,
      };
    }

    if (Date.now() - started >= timeoutMs) {
      lastProgress = { ...lastProgress, TIMED_OUT: pending + retrying };
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
