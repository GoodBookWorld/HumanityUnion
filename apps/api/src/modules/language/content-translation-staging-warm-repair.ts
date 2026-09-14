/**
 * Pack 08I.14B.3 — staging-safe repair for MISSING/STALE content translations.
 *
 * Reuses enqueueContentTranslationWarmRequested (existing outbox path).
 * Skips CURRENT translations. Dry-run by default; execute is gated by the
 * staging warm script guards (not enforced inside this module).
 *
 * Pack 08K — CURRENT_SKIPPED counts recovery identities already CURRENT for
 * discovered families. Operator JSON also exposes the clearer alias
 * `recoveryIdentitiesCurrentForDiscoveredFamilies`. Neither field is
 * site_translation_coverage.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { findContentTranslation } from "./persistence/content-translation.repository.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import {
  enqueueContentTranslationWarmRequested,
  resolveContentTranslationWarmOutboxDisposition,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import { resolveAutomaticContentTranslationWarmTargets } from "./content-translation-warm-targets.js";
import {
  discoverStagingInitiativePathWarmSources,
  type StagingWarmCandidate,
  type StagingWarmDiscoveryDeps,
  type StagingWarmDiscoveryKindCounts,
  type StagingWarmSourceKind,
} from "./content-translation-staging-warm-backfill.js";
import { assertCanonicalSourceEligibleForTranslation } from "./content-translation-eligibility.js";

export type StagingWarmLocaleMaterializationState =
  | "CURRENT"
  | "MISSING"
  | "STALE"
  | "INELIGIBLE"
  | "PENDING"
  | "RETRYING"
  | "FAILED";

export type StagingWarmRepairAction =
  | "MISSING"
  | "STALE"
  | "CURRENT_SKIPPED"
  | "RETRY_SCHEDULED"
  | "REPAIR_SCHEDULED"
  | "FAILED"
  | "INELIGIBLE_SKIPPED";

export interface StagingWarmLocaleAuditRow {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLanguage: LanguageCode;
  readonly sourceVersion: string | null;
  readonly state: StagingWarmLocaleMaterializationState;
}

export interface StagingWarmRepairKindLocaleCounts {
  readonly sourceKind: StagingWarmSourceKind;
  readonly targetLanguage: LanguageCode | "*";
  readonly MISSING: number;
  readonly STALE: number;
  readonly CURRENT_SKIPPED: number;
  readonly RETRY_SCHEDULED: number;
  readonly REPAIR_SCHEDULED: number;
  readonly FAILED: number;
}

export interface StagingWarmRepairResult {
  readonly mode: "dry-run" | "execute";
  readonly audited: readonly StagingWarmLocaleAuditRow[];
  readonly byKindLocale: readonly StagingWarmRepairKindLocaleCounts[];
  readonly totals: {
    readonly MISSING: number;
    readonly STALE: number;
    /** Identities already CURRENT for discovered families (recovery skip). NOT site_translation_coverage. */
    readonly CURRENT_SKIPPED: number;
    /** Pack 08K alias of CURRENT_SKIPPED — clearer recovery label. NOT site_translation_coverage. */
    readonly recoveryIdentitiesCurrentForDiscoveredFamilies: number;
    readonly RETRY_SCHEDULED: number;
    readonly REPAIR_SCHEDULED: number;
    readonly FAILED: number;
  };
  readonly repairCandidates: readonly StagingWarmCandidate[];
  /** Pack 08I.16.1 — discovery funnel so 0/0/0 cannot look like success. */
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly discoveryTotals: {
    readonly SOURCE_RECORDS_DISCOVERED: number;
    readonly PUBLIC_RECORDS: number;
    readonly ELIGIBLE_SOURCE_RECORDS: number;
    readonly LOCALE_TARGETS_AUDITED: number;
  };
  readonly discoveryHint: string | null;
}

/**
 * Classify one source+locale against live canonical sourceVersion.
 * Does not call the provider.
 */
export async function auditContentTranslationMaterialization(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly targetLanguage: LanguageCode;
}): Promise<StagingWarmLocaleAuditRow> {
  const source = await loadTranslatableSource({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
  });
  if (!source) {
    return {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      targetLanguage: input.targetLanguage,
      sourceVersion: null,
      state: "INELIGIBLE",
    };
  }

  try {
    assertCanonicalSourceEligibleForTranslation({
      source: {
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceLanguage: source.sourceLanguage,
        fields: source.fields,
        sourceVersion: source.sourceVersion,
        isPublished: source.isPublished,
        safetyCleared: true,
      },
      intent: "automatic_warm",
    });
  } catch {
    return {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      targetLanguage: input.targetLanguage,
      sourceVersion: source.sourceVersion,
      state: "INELIGIBLE",
    };
  }

  if (source.sourceLanguage === input.targetLanguage) {
    return {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      targetLanguage: input.targetLanguage,
      sourceVersion: source.sourceVersion,
      state: "CURRENT",
    };
  }

  const existing = await findContentTranslation({
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    sourceVersion: source.sourceVersion,
    targetLanguage: input.targetLanguage,
  });

  if (!existing) {
    return {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      targetLanguage: input.targetLanguage,
      sourceVersion: source.sourceVersion,
      state: "MISSING",
    };
  }

  if (existing.stale || existing.freshness === "stale") {
    return {
      sourceKind: source.sourceKind,
      sourceRecordId: source.sourceRecordId,
      targetLanguage: input.targetLanguage,
      sourceVersion: source.sourceVersion,
      state: "STALE",
    };
  }

  return {
    sourceKind: source.sourceKind,
    sourceRecordId: source.sourceRecordId,
    targetLanguage: input.targetLanguage,
    sourceVersion: source.sourceVersion,
    state: "CURRENT",
  };
}

function emptyRepairCounts(
  sourceKind: StagingWarmSourceKind,
  targetLanguage: LanguageCode | "*",
): StagingWarmRepairKindLocaleCounts {
  return {
    sourceKind,
    targetLanguage,
    MISSING: 0,
    STALE: 0,
    CURRENT_SKIPPED: 0,
    RETRY_SCHEDULED: 0,
    REPAIR_SCHEDULED: 0,
    FAILED: 0,
  };
}

/**
 * Audit public Initiative-path sources and optionally enqueue repair warms
 * only for sources that still have MISSING or STALE target locales.
 */
export async function runStagingInitiativePathContentTranslationRepair(input: {
  readonly execute: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
  readonly targetLanguages?: readonly LanguageCode[];
}): Promise<StagingWarmRepairResult> {
  const discovered = await discoverStagingInitiativePathWarmSources({
    kinds: input.kinds,
    deps: input.deps,
  });

  const discoveryByKind = [...discovered.discoveryByKind.values()].sort((a, b) =>
    a.sourceKind.localeCompare(b.sourceKind),
  );

  // Eligible = discovered public candidates that pass load+eligibility (repair audits those).
  const discoveryWithEligible = discoveryByKind.map((row) => {
    const eligible = discovered.candidates.filter((c) => c.sourceKind === row.sourceKind).length;
    return { ...row, eligibleSourceRecords: eligible };
  });

  const { warmTargetLocales } = await resolveAutomaticContentTranslationWarmTargets();
  const targets = (
    input.targetLanguages?.length ? input.targetLanguages : warmTargetLocales
  ) as LanguageCode[];

  const audited: StagingWarmLocaleAuditRow[] = [];
  const repairKeys = new Set<string>();
  const repairCandidates: StagingWarmCandidate[] = [];
  const counts = new Map<string, StagingWarmRepairKindLocaleCounts>();

  const bump = (
    sourceKind: StagingWarmSourceKind,
    targetLanguage: LanguageCode | "*",
    field: keyof Omit<StagingWarmRepairKindLocaleCounts, "sourceKind" | "targetLanguage">,
  ) => {
    const key = `${sourceKind}::${targetLanguage}`;
    const row = counts.get(key) ?? emptyRepairCounts(sourceKind, targetLanguage);
    counts.set(key, { ...row, [field]: row[field] + 1 });
  };

  for (const candidate of discovered.candidates) {
    let needsRepair = false;
    for (const targetLanguage of targets) {
      const row = await auditContentTranslationMaterialization({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
        targetLanguage,
      });
      audited.push(row);

      if (row.state === "CURRENT") {
        bump(candidate.sourceKind, targetLanguage, "CURRENT_SKIPPED");
        continue;
      }
      if (row.state === "INELIGIBLE") {
        continue;
      }
      if (row.state === "MISSING") {
        bump(candidate.sourceKind, targetLanguage, "MISSING");
        needsRepair = true;
      } else if (row.state === "STALE") {
        bump(candidate.sourceKind, targetLanguage, "STALE");
        needsRepair = true;
      }
    }

    if (!needsRepair) {
      continue;
    }

    const key = `${candidate.sourceKind}::${candidate.sourceRecordId}`;
    if (repairKeys.has(key)) {
      continue;
    }
    repairKeys.add(key);
    repairCandidates.push(candidate);

    if (!input.execute) {
      bump(candidate.sourceKind, "*", "REPAIR_SCHEDULED");
      continue;
    }

    try {
      const result: ContentTranslationWarmEnqueueResult =
        await enqueueContentTranslationWarmRequested({
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          reason: "operator_backfill",
        });
      if (result.enqueued || result.deduped) {
        bump(candidate.sourceKind, "*", "RETRY_SCHEDULED");
      } else {
        bump(candidate.sourceKind, "*", "FAILED");
      }
    } catch {
      bump(candidate.sourceKind, "*", "FAILED");
    }
  }

  const byKindLocale = [...counts.values()].sort((a, b) => {
    const kindCmp = a.sourceKind.localeCompare(b.sourceKind);
    if (kindCmp !== 0) {
      return kindCmp;
    }
    return String(a.targetLanguage).localeCompare(String(b.targetLanguage));
  });

  const totalsBase = byKindLocale.reduce(
    (acc, row) => ({
      MISSING: acc.MISSING + row.MISSING,
      STALE: acc.STALE + row.STALE,
      CURRENT_SKIPPED: acc.CURRENT_SKIPPED + row.CURRENT_SKIPPED,
      RETRY_SCHEDULED: acc.RETRY_SCHEDULED + row.RETRY_SCHEDULED,
      REPAIR_SCHEDULED: acc.REPAIR_SCHEDULED + row.REPAIR_SCHEDULED,
      FAILED: acc.FAILED + row.FAILED,
    }),
    {
      MISSING: 0,
      STALE: 0,
      CURRENT_SKIPPED: 0,
      RETRY_SCHEDULED: 0,
      REPAIR_SCHEDULED: 0,
      FAILED: 0,
    },
  );
  const totals = {
    ...totalsBase,
    // Pack 08K — clearer recovery label; NOT site_translation_coverage.
    recoveryIdentitiesCurrentForDiscoveredFamilies: totalsBase.CURRENT_SKIPPED,
  };

  const discoveryTotals = discoveryWithEligible.reduce(
    (acc, row) => ({
      SOURCE_RECORDS_DISCOVERED: acc.SOURCE_RECORDS_DISCOVERED + row.sourceRecordsDiscovered,
      PUBLIC_RECORDS: acc.PUBLIC_RECORDS + row.publicRecords,
      ELIGIBLE_SOURCE_RECORDS: acc.ELIGIBLE_SOURCE_RECORDS + row.eligibleSourceRecords,
      LOCALE_TARGETS_AUDITED: acc.LOCALE_TARGETS_AUDITED,
    }),
    {
      SOURCE_RECORDS_DISCOVERED: 0,
      PUBLIC_RECORDS: 0,
      ELIGIBLE_SOURCE_RECORDS: 0,
      LOCALE_TARGETS_AUDITED: audited.length,
    },
  );

  return {
    mode: input.execute ? "execute" : "dry-run",
    audited,
    byKindLocale,
    totals,
    repairCandidates,
    discoveryByKind: discoveryWithEligible,
    discoveryTotals,
    discoveryHint: discovered.discoveryHint,
  };
}

export type StagingWarmWaitTargetIdentity = {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: LanguageCode;
};

export type StagingWarmWaitProgress = {
  readonly targetsTotal: number;
  readonly current: number;
  readonly pending: number;
  readonly retrying: number;
  readonly terminalFailed: number;
  readonly timedOut: number;
};

/**
 * Bounded poll until CURRENT for each candidate×locale, or timeout.
 * Resolves sourceVersion once per candidate, then tracks compact identities
 * only — poll loops use indexed findContentTranslation lookups and do not
 * reload source documents or run the provider. Expects the live outbox
 * consumer to process.
 */
export async function waitForStagingWarmMaterialization(input: {
  readonly candidates: readonly StagingWarmCandidate[];
  readonly targetLanguages?: readonly LanguageCode[];
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly onProgress?: (progress: StagingWarmWaitProgress) => void;
}): Promise<{
  readonly timedOut: boolean;
  readonly elapsedMs: number;
  readonly remainingMissingOrStale: readonly StagingWarmLocaleAuditRow[];
  readonly currentCount: number;
  readonly progress: StagingWarmWaitProgress;
}> {
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 120_000);
  const pollIntervalMs = Math.max(250, input.pollIntervalMs ?? 2_000);
  const started = Date.now();

  const { warmTargetLocales } = await resolveAutomaticContentTranslationWarmTargets();
  const targets = (
    input.targetLanguages?.length ? input.targetLanguages : warmTargetLocales
  ) as LanguageCode[];

  const identities: StagingWarmWaitTargetIdentity[] = [];
  for (const candidate of input.candidates) {
    // Resolve version once per candidate (compact string only). Do not retain
    // hydrated source objects across polls.
    const source = await loadTranslatableSource({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });
    if (!source) {
      continue;
    }
    for (const targetLanguage of targets) {
      identities.push({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
        sourceVersion: source.sourceVersion,
        targetLanguage,
      });
    }
  }

  let lastProgress: StagingWarmWaitProgress = {
    targetsTotal: identities.length,
    current: 0,
    pending: identities.length,
    retrying: 0,
    terminalFailed: 0,
    timedOut: 0,
  };

  // Cache outbox disposition per source aggregate across locales in one poll.
  const outboxDispositionByAggregate = new Map<
    string,
    Awaited<ReturnType<typeof resolveContentTranslationWarmOutboxDisposition>>
  >();

  async function outboxDispositionFor(identity: StagingWarmWaitTargetIdentity) {
    const key = `${identity.sourceKind}::${identity.sourceRecordId}`;
    const cached = outboxDispositionByAggregate.get(key);
    if (cached) {
      return cached;
    }
    const disposition = await resolveContentTranslationWarmOutboxDisposition({
      sourceKind: identity.sourceKind,
      sourceRecordId: identity.sourceRecordId,
    });
    outboxDispositionByAggregate.set(key, disposition);
    return disposition;
  }

  for (;;) {
    let current = 0;
    let pending = 0;
    let retrying = 0;
    let terminalFailed = 0;
    const remaining: StagingWarmLocaleAuditRow[] = [];
    outboxDispositionByAggregate.clear();

    // Bound poll reads: one indexed lookup per identity; discard prior poll set.
    // Does not call loadTranslatableSource or the provider.
    for (const identity of identities) {
      const row = await findContentTranslation({
        sourceKind: identity.sourceKind,
        sourceRecordId: identity.sourceRecordId,
        sourceVersion: identity.sourceVersion,
        targetLanguage: identity.targetLanguage,
      });

      if (!row) {
        const disposition = await outboxDispositionFor(identity);
        if (disposition === "failed") {
          terminalFailed += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: "FAILED",
          });
        } else if (disposition === "published") {
          // Pack 08K.2 — consumed without CURRENT row is a residual, not PENDING.
          terminalFailed += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: "FAILED",
          });
        } else if (disposition === "pending") {
          pending += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: "PENDING",
          });
        } else {
          pending += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: "MISSING",
          });
        }
        continue;
      }

      if (row.freshness === "regenerating") {
        retrying += 1;
        remaining.push({
          sourceKind: identity.sourceKind,
          sourceRecordId: identity.sourceRecordId,
          sourceVersion: identity.sourceVersion,
          targetLanguage: identity.targetLanguage,
          state: "RETRYING",
        });
        continue;
      }

      if (row.stale || row.freshness === "stale") {
        const disposition = await outboxDispositionFor(identity);
        if (disposition === "failed") {
          terminalFailed += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: "FAILED",
          });
        } else {
          pending += 1;
          remaining.push({
            sourceKind: identity.sourceKind,
            sourceRecordId: identity.sourceRecordId,
            sourceVersion: identity.sourceVersion,
            targetLanguage: identity.targetLanguage,
            state: disposition === "pending" ? "PENDING" : "STALE",
          });
        }
        continue;
      }

      // freshness current + not stale → materialized
      current += 1;
    }

    lastProgress = {
      targetsTotal: identities.length,
      current,
      pending,
      retrying,
      terminalFailed,
      timedOut: 0,
    };
    input.onProgress?.(lastProgress);

    if (remaining.length === 0) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        remainingMissingOrStale: [],
        currentCount: current,
        progress: lastProgress,
      };
    }

    // Pack 08J — do not wait forever when only terminal failures remain.
    if (pending === 0 && retrying === 0 && terminalFailed > 0) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        remainingMissingOrStale: remaining,
        currentCount: current,
        progress: lastProgress,
      };
    }

    if (Date.now() - started >= timeoutMs) {
      lastProgress = { ...lastProgress, timedOut: remaining.length };
      input.onProgress?.(lastProgress);
      return {
        timedOut: true,
        elapsedMs: Date.now() - started,
        remainingMissingOrStale: remaining,
        currentCount: current,
        progress: lastProgress,
      };
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      timer.unref?.();
    });
  }
}
