/**
 * Pack 08I.14B.3 — staging-safe repair for MISSING/STALE content translations.
 *
 * Reuses enqueueContentTranslationWarmRequested (existing outbox path).
 * Skips CURRENT translations. Dry-run by default; execute is gated by the
 * staging warm script guards (not enforced inside this module).
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { findContentTranslation } from "./persistence/content-translation.repository.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import {
  enqueueContentTranslationWarmRequested,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import { resolveAutomaticContentTranslationWarmTargets } from "./content-translation-warm-targets.js";
import {
  discoverStagingInitiativePathWarmSources,
  type StagingWarmCandidate,
  type StagingWarmDiscoveryDeps,
  type StagingWarmSourceKind,
} from "./content-translation-staging-warm-backfill.js";
import { assertCanonicalSourceEligibleForTranslation } from "./content-translation-eligibility.js";

export type StagingWarmLocaleMaterializationState =
  | "CURRENT"
  | "MISSING"
  | "STALE"
  | "INELIGIBLE";

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
    readonly CURRENT_SKIPPED: number;
    readonly RETRY_SCHEDULED: number;
    readonly REPAIR_SCHEDULED: number;
    readonly FAILED: number;
  };
  readonly repairCandidates: readonly StagingWarmCandidate[];
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

  const totals = byKindLocale.reduce(
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

  return {
    mode: input.execute ? "execute" : "dry-run",
    audited,
    byKindLocale,
    totals,
    repairCandidates,
  };
}

/**
 * Bounded poll until CURRENT for each candidate×locale, or timeout.
 * Does not run the provider; expects the live outbox consumer to process.
 */
export async function waitForStagingWarmMaterialization(input: {
  readonly candidates: readonly StagingWarmCandidate[];
  readonly targetLanguages?: readonly LanguageCode[];
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
}): Promise<{
  readonly timedOut: boolean;
  readonly elapsedMs: number;
  readonly remainingMissingOrStale: readonly StagingWarmLocaleAuditRow[];
  readonly currentCount: number;
}> {
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 120_000);
  const pollIntervalMs = Math.max(250, input.pollIntervalMs ?? 2_000);
  const started = Date.now();

  const { warmTargetLocales } = await resolveAutomaticContentTranslationWarmTargets();
  const targets = (
    input.targetLanguages?.length ? input.targetLanguages : warmTargetLocales
  ) as LanguageCode[];

  let remaining: StagingWarmLocaleAuditRow[] = [];
  let currentCount = 0;

  for (;;) {
    remaining = [];
    currentCount = 0;
    for (const candidate of input.candidates) {
      for (const targetLanguage of targets) {
        const row = await auditContentTranslationMaterialization({
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          targetLanguage,
        });
        if (row.state === "CURRENT" || row.state === "INELIGIBLE") {
          if (row.state === "CURRENT") {
            currentCount += 1;
          }
          continue;
        }
        remaining.push(row);
      }
    }

    if (remaining.length === 0) {
      return {
        timedOut: false,
        elapsedMs: Date.now() - started,
        remainingMissingOrStale: [],
        currentCount,
      };
    }

    if (Date.now() - started >= timeoutMs) {
      return {
        timedOut: true,
        elapsedMs: Date.now() - started,
        remainingMissingOrStale: remaining,
        currentCount,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
