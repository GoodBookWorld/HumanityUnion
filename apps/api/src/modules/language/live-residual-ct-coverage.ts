/**
 * Bounded live CT coverage for Admin Readiness.
 * Same discovery + preflight boundary as residual activation.
 * Read-only: no enqueue, no provider, no writes.
 */

import {
  emptyLanguageLocalizationCountBucket,
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  type LanguageCode,
  type LanguageLocalizationCountBucket,
} from "@hu/types";

import { discoverStagingInitiativePathWarmSources } from "./content-translation-staging-warm-backfill.js";
import type { StagingWarmSourceKind } from "./content-translation-staging-warm-operator-scope.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import {
  classifyLiveResidualIdentity,
  type LiveResidualIdentityBucket,
} from "./live-residual-identity.js";
import { buildPublicLocalizationRetryPreflight } from "./public-localization-retry-preflight.js";

export type LiveResidualKindCoverage = {
  readonly kindId: string;
  readonly counts: LanguageLocalizationCountBucket;
};

export type LiveActivationCtCoverage = {
  readonly ct: LanguageLocalizationCountBucket;
  readonly kindRows: readonly LiveResidualKindCoverage[];
};

type MutableBucket = {
  current: number;
  missing: number;
  stale: number;
  failed: number;
  pending: number;
  workItemsRequired: number;
};

function emptyMutable(): MutableBucket {
  return {
    current: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    workItemsRequired: 0,
  };
}

function freezeBucket(bucket: MutableBucket): LanguageLocalizationCountBucket {
  return { ...bucket };
}

export function applyLiveResidualBucket(
  bucket: MutableBucket,
  classification: LiveResidualIdentityBucket,
): void {
  switch (classification) {
    case "CURRENT":
      bucket.current += 1;
      return;
    case "RETRY_READY_MISSING":
      bucket.missing += 1;
      bucket.workItemsRequired += 1;
      return;
    case "RETRY_READY_STALE":
      bucket.stale += 1;
      bucket.workItemsRequired += 1;
      return;
    case "BLOCKED_FAILED_ATTEMPT":
      bucket.failed += 1;
      return;
    case "ACTIVE_WORK":
    case "SOURCE_OR_PREFLIGHT_BLOCKED":
      bucket.pending += 1;
      return;
    default: {
      const _exhaustive: never = classification;
      return _exhaustive;
    }
  }
}

export function accumulateLiveResidualCounts(
  classifications: readonly LiveResidualIdentityBucket[],
): LanguageLocalizationCountBucket {
  const bucket = emptyMutable();
  for (const classification of classifications) {
    applyLiveResidualBucket(bucket, classification);
  }
  return freezeBucket(bucket);
}

function activationCtKinds(
  kinds: readonly string[] | undefined,
): StagingWarmSourceKind[] {
  const requested = kinds?.length ? kinds : [...LANGUAGE_ACTIVATION_CT_OWNED_KINDS];
  return requested.filter(
    (kind): kind is StagingWarmSourceKind => kind !== "public_news",
  );
}

/**
 * Classify every live eligible activation identity for one locale.
 * Historical stale rows are never loaded and never counted.
 */
export async function measureLiveActivationCtCoverage(input: {
  readonly locale: string;
  readonly kinds?: readonly StagingWarmSourceKind[];
}): Promise<LiveActivationCtCoverage> {
  const locale = input.locale.trim();
  const kinds = activationCtKinds(input.kinds);
  const byKind = new Map<string, MutableBucket>();
  for (const kind of kinds) {
    byKind.set(kind, emptyMutable());
  }

  const discovered = await discoverStagingInitiativePathWarmSources({ kinds });

  for (const candidate of discovered.candidates) {
    if (candidate.sourceKind === "public_news" || !byKind.has(candidate.sourceKind)) {
      continue;
    }
    const bucket = byKind.get(candidate.sourceKind);
    if (!bucket) {
      continue;
    }

    let classification: LiveResidualIdentityBucket = "SOURCE_OR_PREFLIGHT_BLOCKED";
    try {
      const source = await loadTranslatableSource({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
      });
      const preflight = await buildPublicLocalizationRetryPreflight({
        workItem: {
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          sourceVersion: source?.sourceVersion ?? "unloaded",
          targetLanguage: locale as LanguageCode,
          state: "MISSING",
          autoNodeCount: 0,
          missingOrStaleNodeCount: 0,
          fallbackPaths: [],
        },
      });
      classification = classifyLiveResidualIdentity({
        liveCurrent: preflight.readyState === "CURRENT",
        liveStale: preflight.liveTranslationStale === true,
        preflightReady: preflight.ready,
        readyState: preflight.readyState,
        terminalFailureForCurrentVersion: preflight.terminalFailureForCurrentVersion,
      });
    } catch {
      classification = "SOURCE_OR_PREFLIGHT_BLOCKED";
    }
    applyLiveResidualBucket(bucket, classification);
  }

  const kindRows: LiveResidualKindCoverage[] = kinds.map((kindId) => ({
    kindId,
    counts: freezeBucket(byKind.get(kindId) ?? emptyMutable()),
  }));
  const ct = emptyMutable();
  for (const row of kindRows) {
    ct.current += row.counts.current;
    ct.missing += row.counts.missing;
    ct.stale += row.counts.stale;
    ct.failed += row.counts.failed;
    ct.pending += row.counts.pending;
    ct.workItemsRequired += row.counts.workItemsRequired;
  }

  return {
    ct: freezeBucket(ct),
    kindRows,
  };
}

export function emptyLiveActivationCtCoverage(
  kinds: readonly string[] = LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
): LiveActivationCtCoverage {
  const filtered = activationCtKinds(kinds);
  return {
    ct: emptyLanguageLocalizationCountBucket(),
    kindRows: filtered.map((kindId) => ({
      kindId,
      counts: emptyLanguageLocalizationCountBucket(),
    })),
  };
}
