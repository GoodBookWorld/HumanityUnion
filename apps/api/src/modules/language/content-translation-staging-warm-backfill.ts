/**
 * Pack 08I.14B / 08I.14B.1 — staging-safe ContentTranslationWarm backfill enumerator.
 *
 * Reuses enqueueContentTranslationWarmRequested (existing outbox path).
 * Does not overwrite canonical text. Safe to rerun (pending dedupe + consumer
 * skipped_existing for current translations).
 *
 * Pack 08I.14B.1 — enumerator reads the SAME in-memory/Mongo stores as the live
 * API. Scripts MUST call bootstrapContentTranslationOperatorPersistence()
 * (or full bootstrapMongoPersistence) before enumeration so
 * Mongo snapshot adapters are hydrated and Initiative/Analysis stores synced.
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

/** Discovery funnel — distinguishes empty store vs eligibility filtering. */
export interface StagingWarmDiscoveryKindCounts {
  readonly sourceKind: StagingWarmSourceKind;
  /** RAW — records observed from the live persistence/store path. */
  readonly sourceRecordsDiscovered: number;
  /** PUBLIC — records that pass public/approved/published filters. */
  readonly publicRecords: number;
  /** ELIGIBLE — loadTranslatableSource + warm eligibility assert pass. */
  readonly eligibleSourceRecords: number;
  /** WARM_REQUEST_CANDIDATES — records that would receive a warm enqueue. */
  readonly warmRequestCandidates: number;
  readonly scheduled: number;
  readonly skippedCurrentOrIneligible: number;
  readonly deduped: number;
  readonly failed: number;
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
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly totals: {
    readonly sourceRecordsDiscovered: number;
    readonly publicRecords: number;
    readonly eligibleSourceRecords: number;
    readonly warmRequestCandidates: number;
    /** @deprecated Prefer warmRequestCandidates — kept for prior report shape. */
    readonly candidates: number;
    readonly scheduled: number;
    readonly skippedCurrentOrIneligible: number;
    readonly deduped: number;
    readonly failed: number;
  };
  readonly discoveryHint: string | null;
}

function isWarmKind(value: string): value is StagingWarmSourceKind {
  return (STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS as readonly string[]).includes(value);
}

function emptyDiscovery(kind: StagingWarmSourceKind): StagingWarmDiscoveryKindCounts {
  return {
    sourceKind: kind,
    sourceRecordsDiscovered: 0,
    publicRecords: 0,
    eligibleSourceRecords: 0,
    warmRequestCandidates: 0,
    scheduled: 0,
    skippedCurrentOrIneligible: 0,
    deduped: 0,
    failed: 0,
  };
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

export interface StagingWarmDiscoveryDeps {
  readonly listInitiatives?: typeof listInitiatives;
  readonly listApprovedInitiativeComments?: typeof listApprovedInitiativeComments;
  readonly listPublishedAnalysesByInitiative?: typeof listPublishedAnalysesByInitiative;
  readonly listPetitions?: typeof listPetitions;
}

/**
 * Enumerate public Initiative-path records eligible for translation warm.
 * Requires hydrated Initiative/Analysis stores when persistence mode is mongodb.
 */
export async function listStagingInitiativePathWarmCandidates(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<readonly StagingWarmCandidate[]> {
  const discovered = await discoverStagingInitiativePathWarmSources(input);
  return discovered.candidates;
}

export interface StagingWarmDiscoveryResult {
  readonly candidates: readonly StagingWarmCandidate[];
  readonly discoveryByKind: ReadonlyMap<StagingWarmSourceKind, StagingWarmDiscoveryKindCounts>;
  readonly discoveryHint: string | null;
}

/**
 * Full discovery funnel used by dry-run/execute reporting.
 */
export async function discoverStagingInitiativePathWarmSources(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<StagingWarmDiscoveryResult> {
  const allowed = new Set<StagingWarmSourceKind>(
    input?.kinds?.length
      ? input.kinds.filter(isWarmKind)
      : [...STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS],
  );
  const deps = {
    listInitiatives: input?.deps?.listInitiatives ?? listInitiatives,
    listApprovedInitiativeComments:
      input?.deps?.listApprovedInitiativeComments ?? listApprovedInitiativeComments,
    listPublishedAnalysesByInitiative:
      input?.deps?.listPublishedAnalysesByInitiative ?? listPublishedAnalysesByInitiative,
    listPetitions: input?.deps?.listPetitions ?? listPetitions,
  };

  const discovery = new Map<StagingWarmSourceKind, StagingWarmDiscoveryKindCounts>();
  const ensure = (kind: StagingWarmSourceKind) => {
    const existing = discovery.get(kind);
    if (existing) {
      return existing;
    }
    const created = emptyDiscovery(kind);
    discovery.set(kind, created);
    return created;
  };
  const bumpField = (
    kind: StagingWarmSourceKind,
    field: keyof Omit<StagingWarmDiscoveryKindCounts, "sourceKind">,
    by = 1,
  ) => {
    const row = { ...ensure(kind) };
    row[field] = (row[field] as number) + by;
    discovery.set(kind, row);
  };

  const out: StagingWarmCandidate[] = [];
  const seen = new Set<string>();
  const pushCandidate = (sourceKind: StagingWarmSourceKind, sourceRecordId: string) => {
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
    bumpField(sourceKind, "publicRecords");
    out.push({ sourceKind, sourceRecordId: id });
  };

  const allInitiatives = deps.listInitiatives();
  if (
    allowed.has("initiative") ||
    allowed.has("discussion_comment") ||
    allowed.has("collaborative_analysis") ||
    allowed.has("petition")
  ) {
    bumpField("initiative", "sourceRecordsDiscovered", allInitiatives.length);
  }

  const publicInitiatives = allInitiatives.filter(canExposePublicInitiativeProjection);

  let petitionsByInitiative = new Map<string, string[]>();
  if (allowed.has("petition")) {
    try {
      const petitions = await deps.listPetitions();
      bumpField("petition", "sourceRecordsDiscovered", petitions.length);
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
      bumpField("petition", "sourceRecordsDiscovered", 0);
    }
  }

  for (const initiative of publicInitiatives) {
    pushCandidate("initiative", initiative.initiativeId);

    if (allowed.has("discussion_comment")) {
      let offset = 0;
      const limit = 100;
      for (;;) {
        const page = await deps.listApprovedInitiativeComments({
          initiativeId: initiative.initiativeId,
          limit,
          offset,
        });
        bumpField("discussion_comment", "sourceRecordsDiscovered", page.comments.length);
        for (const comment of page.comments) {
          if (comment.status === "approved" && !comment.deletedAt) {
            pushCandidate("discussion_comment", comment.commentId);
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
      const analyses = deps.listPublishedAnalysesByInitiative(initiative.initiativeId);
      bumpField("collaborative_analysis", "sourceRecordsDiscovered", analyses.length);
      for (const analysis of analyses) {
        pushCandidate("collaborative_analysis", analysis.analysisId);
      }
    }

    if (allowed.has("petition")) {
      for (const petitionId of petitionsByInitiative.get(initiative.initiativeId) ?? []) {
        pushCandidate("petition", petitionId);
      }
    }
  }

  let discoveryHint: string | null = null;
  if (allInitiatives.length === 0) {
    discoveryHint =
      "SOURCE_RECORDS_DISCOVERED.initiative=0 — Mongo snapshot stores may be unhydrated. Call bootstrapContentTranslationOperatorPersistence() before warm enumeration (live API uses full bootstrapMongoPersistence on boot).";
  }

  return {
    candidates: out,
    discoveryByKind: discovery,
    discoveryHint,
  };
}

/**
 * Dry-run or enqueue warm requests for Initiative-path public records.
 * Consumer skips current translations; missing/stale regenerate via existing path.
 */
export async function runStagingInitiativePathContentTranslationWarm(input: {
  readonly execute: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<StagingWarmBackfillResult> {
  const discovered = await discoverStagingInitiativePathWarmSources({
    kinds: input.kinds,
    deps: input.deps,
  });

  const discovery = new Map(discovered.discoveryByKind);
  const warmRequestCandidates: StagingWarmCandidate[] = [];

  const bump = (
    kind: StagingWarmSourceKind,
    field: keyof Omit<StagingWarmDiscoveryKindCounts, "sourceKind">,
  ) => {
    const row = discovery.get(kind) ?? emptyDiscovery(kind);
    const next = { ...row, [field]: (row[field] as number) + 1 };
    discovery.set(kind, next);
  };

  for (const candidate of discovered.candidates) {
    const eligibility = await classifyCandidate(candidate);
    if (eligibility === "skipped") {
      bump(candidate.sourceKind, "skippedCurrentOrIneligible");
      continue;
    }

    bump(candidate.sourceKind, "eligibleSourceRecords");
    bump(candidate.sourceKind, "warmRequestCandidates");
    warmRequestCandidates.push(candidate);

    if (!input.execute) {
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

  const discoveryByKind = [...discovery.values()];
  const byKind: StagingWarmKindCounts[] = discoveryByKind
    .filter(
      (row) =>
        row.sourceRecordsDiscovered > 0 ||
        row.publicRecords > 0 ||
        row.warmRequestCandidates > 0 ||
        row.scheduled > 0 ||
        row.skippedCurrentOrIneligible > 0 ||
        row.deduped > 0 ||
        row.failed > 0,
    )
    .map((row) => ({
      sourceKind: row.sourceKind,
      candidates: row.warmRequestCandidates,
      scheduled: row.scheduled,
      skippedCurrentOrIneligible: row.skippedCurrentOrIneligible,
      deduped: row.deduped,
      failed: row.failed,
    }));

  const totals = discoveryByKind.reduce(
    (acc, row) => ({
      sourceRecordsDiscovered: acc.sourceRecordsDiscovered + row.sourceRecordsDiscovered,
      publicRecords: acc.publicRecords + row.publicRecords,
      eligibleSourceRecords: acc.eligibleSourceRecords + row.eligibleSourceRecords,
      warmRequestCandidates: acc.warmRequestCandidates + row.warmRequestCandidates,
      candidates: acc.candidates + row.warmRequestCandidates,
      scheduled: acc.scheduled + row.scheduled,
      skippedCurrentOrIneligible:
        acc.skippedCurrentOrIneligible + row.skippedCurrentOrIneligible,
      deduped: acc.deduped + row.deduped,
      failed: acc.failed + row.failed,
    }),
    {
      sourceRecordsDiscovered: 0,
      publicRecords: 0,
      eligibleSourceRecords: 0,
      warmRequestCandidates: 0,
      candidates: 0,
      scheduled: 0,
      skippedCurrentOrIneligible: 0,
      deduped: 0,
      failed: 0,
    },
  );

  return {
    mode: input.execute ? "execute" : "dry-run",
    candidates: warmRequestCandidates,
    byKind,
    discoveryByKind,
    totals,
    discoveryHint: discovered.discoveryHint,
  };
}
