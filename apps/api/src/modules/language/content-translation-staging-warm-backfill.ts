/**
 * Pack 08I.14B — staging-safe ContentTranslationWarm backfill enumerator.
 *
 * Reuses enqueueContentTranslationWarmRequested (existing outbox path).
 * Does not overwrite canonical text. Safe to rerun (pending dedupe + consumer
 * skipped_existing for current translations).
 */

import type { ContentTranslationSourceKind } from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  listApprovedInitiativeComments,
} from "../initiative-comments/initiative-comment.service.js";
import { listInitiatives } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { listPetitions } from "../petition/petition.store.js";
import {
  enqueueContentTranslationWarmRequested,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import {
  assertCanonicalSourceEligibleForTranslation,
} from "./content-translation-eligibility.js";

/** Initiative-path sourceKinds warmed by this operator backfill (not Blog/Media). */
export const STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS = [
  "initiative",
  "discussion_comment",
  "collaborative_analysis",
  "petition",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
] as const satisfies readonly ContentTranslationSourceKind[];

export type StagingWarmSourceKind = (typeof STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS)[number];

export interface StagingWarmCandidate {
  readonly sourceKind: StagingWarmSourceKind;
  readonly sourceRecordId: string;
}

export interface StagingWarmKindCounts {
  readonly sourceKind: StagingWarmSourceKind;
  readonly candidates: number;
  readonly scheduled: number;
  readonly skippedCurrentOrIneligible: number;
  readonly deduped: number;
  readonly failed: number;
}

export interface StagingWarmBackfillResult {
  readonly mode: "dry-run" | "execute";
  readonly candidates: readonly StagingWarmCandidate[];
  readonly byKind: readonly StagingWarmKindCounts[];
  readonly totals: {
    readonly candidates: number;
    readonly scheduled: number;
    readonly skippedCurrentOrIneligible: number;
    readonly deduped: number;
    readonly failed: number;
  };
}

function isWarmKind(value: string): value is StagingWarmSourceKind {
  return (STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * Enumerate public Initiative-path records eligible for translation warm.
 */
export async function listStagingInitiativePathWarmCandidates(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
}): Promise<StagingWarmCandidate[]> {
  const allowed = new Set<StagingWarmSourceKind>(
    input?.kinds?.length
      ? input.kinds.filter(isWarmKind)
      : [...STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS],
  );
  const out: StagingWarmCandidate[] = [];
  const seen = new Set<string>();

  const push = (sourceKind: StagingWarmSourceKind, sourceRecordId: string) => {
    if (!allowed.has(sourceKind)) {
      return;
    }
    const id = sourceRecordId.trim();
    if (!id) {
      return;
    }
    const key = `${sourceKind}::${id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ sourceKind, sourceRecordId: id });
  };

  const publicInitiatives = listInitiatives().filter(canExposePublicInitiativeProjection);

  let petitionsByInitiative = new Map<string, string[]>();
  if (allowed.has("petition")) {
    try {
      const petitions = await listPetitions();
      petitionsByInitiative = new Map();
      for (const petition of petitions) {
        if (petition.status === "Draft") {
          continue;
        }
        const initiativeId = petition.subject.initiativeId;
        const list = petitionsByInitiative.get(initiativeId) ?? [];
        list.push(petition.petitionId);
        petitionsByInitiative.set(initiativeId, list);
      }
    } catch {
      petitionsByInitiative = new Map();
    }
  }

  for (const initiative of publicInitiatives) {
    push("initiative", initiative.initiativeId);

    if (allowed.has("discussion_comment")) {
      let offset = 0;
      const limit = 100;
      for (;;) {
        const page = await listApprovedInitiativeComments({
          initiativeId: initiative.initiativeId,
          limit,
          offset,
        });
        for (const comment of page.comments) {
          if (comment.status === "approved" && !comment.deletedAt) {
            push("discussion_comment", comment.commentId);
          }
        }
        if (!page.hasMore) {
          break;
        }
        offset += page.comments.length;
        if (page.comments.length === 0) {
          break;
        }
      }
    }

    if (allowed.has("collaborative_analysis")) {
      for (const analysis of listPublishedAnalysesByInitiative(initiative.initiativeId)) {
        push("collaborative_analysis", analysis.analysisId);
      }
    }

    if (allowed.has("petition")) {
      for (const petitionId of petitionsByInitiative.get(initiative.initiativeId) ?? []) {
        push("petition", petitionId);
      }
    }
  }

  return out;
}

async function classifyCandidate(
  candidate: StagingWarmCandidate,
): Promise<"eligible" | "skipped"> {
  try {
    const source = await loadTranslatableSource(candidate);
    if (!source) {
      return "skipped";
    }
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
    return "eligible";
  } catch {
    return "skipped";
  }
}

/**
 * Dry-run or enqueue warm requests for Initiative-path public records.
 * Consumer skips current translations; missing/stale regenerate via existing path.
 */
export async function runStagingInitiativePathContentTranslationWarm(input: {
  readonly execute: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
}): Promise<StagingWarmBackfillResult> {
  const candidates = await listStagingInitiativePathWarmCandidates({
    kinds: input.kinds,
  });

  const kindMap = new Map<
    StagingWarmSourceKind,
    {
      candidates: number;
      scheduled: number;
      skippedCurrentOrIneligible: number;
      deduped: number;
      failed: number;
    }
  >();

  const bump = (
    kind: StagingWarmSourceKind,
    field: keyof Omit<(typeof kindMap extends Map<infer _K, infer V> ? V : never), "candidates">,
  ) => {
    const row = kindMap.get(kind) ?? {
      candidates: 0,
      scheduled: 0,
      skippedCurrentOrIneligible: 0,
      deduped: 0,
      failed: 0,
    };
    row[field] += 1;
    kindMap.set(kind, row);
  };

  for (const candidate of candidates) {
    const row = kindMap.get(candidate.sourceKind) ?? {
      candidates: 0,
      scheduled: 0,
      skippedCurrentOrIneligible: 0,
      deduped: 0,
      failed: 0,
    };
    row.candidates += 1;
    kindMap.set(candidate.sourceKind, row);

    const eligibility = await classifyCandidate(candidate);
    if (eligibility === "skipped") {
      bump(candidate.sourceKind, "skippedCurrentOrIneligible");
      continue;
    }

    if (!input.execute) {
      // Dry-run: would schedule; consumer would skip-current at execution.
      bump(candidate.sourceKind, "scheduled");
      continue;
    }

    try {
      const result: ContentTranslationWarmEnqueueResult =
        await enqueueContentTranslationWarmRequested({
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          reason: "operator_backfill",
        });
      if (result.deduped) {
        bump(candidate.sourceKind, "deduped");
      } else if (result.enqueued) {
        bump(candidate.sourceKind, "scheduled");
      } else {
        bump(candidate.sourceKind, "skippedCurrentOrIneligible");
      }
    } catch {
      bump(candidate.sourceKind, "failed");
    }
  }

  const byKind: StagingWarmKindCounts[] = [...kindMap.entries()].map(([sourceKind, counts]) => ({
    sourceKind,
    ...counts,
  }));

  const totals = byKind.reduce(
    (acc, row) => ({
      candidates: acc.candidates + row.candidates,
      scheduled: acc.scheduled + row.scheduled,
      skippedCurrentOrIneligible:
        acc.skippedCurrentOrIneligible + row.skippedCurrentOrIneligible,
      deduped: acc.deduped + row.deduped,
      failed: acc.failed + row.failed,
    }),
    {
      candidates: 0,
      scheduled: 0,
      skippedCurrentOrIneligible: 0,
      deduped: 0,
      failed: 0,
    },
  );

  return {
    mode: input.execute ? "execute" : "dry-run",
    candidates,
    byKind,
    totals,
  };
}
