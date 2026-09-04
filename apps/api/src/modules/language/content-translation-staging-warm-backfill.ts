/**
 * Pack 08I.14B / 08I.14B.1 / 08J.1 — staging-safe ContentTranslationWarm backfill enumerator.
 *
 * Reuses enqueueContentTranslationWarmRequested (existing outbox path).
 * Does not overwrite canonical text. Safe to rerun (pending dedupe + consumer
 * skipped_existing for current translations).
 *
 * Pack 08I.14B.1 — enumerator reads the SAME in-memory/Mongo stores as the live
 * API. Scripts MUST call bootstrapContentTranslationOperatorPersistence()
 * (or full bootstrapMongoPersistence) before enumeration so
 * Mongo snapshot adapters are hydrated and Initiative/Analysis stores synced.
 *
 * Pack 08J.1 — recovery discovery audits ALL registered AUTO_TRANSLATABLE
 * projection families (Initiative-path + blog_post + civic_media). Normal
 * lifecycle remains mutation-driven; this enumerator is for historical
 * recovery / staging operator use only.
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
  discoverCivicMediaTranslationRecordIds,
} from "./content-translation-civic-loaders.js";
import {
  enqueueContentTranslationWarmRequested,
  type ContentTranslationWarmEnqueueResult,
} from "./content-translation-warm-enqueue.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import {
  assertCanonicalSourceEligibleForTranslation,
} from "./content-translation-eligibility.js";

/**
 * Pack 08J.1 — universal recovery/discovery source kinds.
 * Includes Initiative-path civic families plus blog_post and civic_media.
 */
export const CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS = [
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
  "blog_post",
  "civic_media",
] as const satisfies readonly ContentTranslationSourceKind[];

/**
 * Backward-compatible alias — same array as CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS
 * so existing warm/repair scripts and tests pick up new kinds automatically.
 */
export const STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS =
  CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS;

export type StagingWarmSourceKind =
  (typeof CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS)[number];

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
  return (CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS as readonly string[]).includes(value);
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
  /** Published blog posts only (no drafts). Injectable for unit fixtures. */
  readonly listPublishedBlogPostsForSearch?: () => Promise<ReadonlyArray<{ postId: string }>>;
  readonly listPublicInitiativeImprovementProposals?: (
    initiativeId: string,
  ) => Promise<ReadonlyArray<{ proposalId: string }>>;
  readonly listRevisionsByInitiative?: (
    initiativeId: string,
  ) => ReadonlyArray<{ revisionId: string }>;
  readonly listPublicDecisionSessionsForInitiative?: (
    initiativeId: string,
  ) => ReadonlyArray<{ sessionId: string }>;
  readonly listPublicInitiativeCollectiveDecisionsForInitiative?: (
    initiativeId: string,
  ) => Promise<ReadonlyArray<{ decisionId: string }>>;
  readonly listPublicInitiativeImplementationCommitmentsForInitiative?: (
    initiativeId: string,
  ) => Promise<ReadonlyArray<{ commitmentId: string }>>;
  readonly listPublicInitiativeImplementationTrackingsForInitiative?: (
    initiativeId: string,
  ) => Promise<ReadonlyArray<{ trackingId: string }>>;
  readonly listPublicOfficialResponsesForInitiative?: (
    initiativeId: string,
  ) => ReadonlyArray<{ responseId: string }>;
  readonly listPublicInitiativePublicImpactsForInitiative?: (
    initiativeId: string,
  ) => Promise<ReadonlyArray<{ impactId: string }>>;
  readonly listPublicCivicArchiveForInitiative?: (
    initiativeId: string,
  ) => ReadonlyArray<{ archiveRecordId: string }>;
}

/**
 * Enumerate public recovery-path records eligible for translation warm.
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
 * Pack 08J.1 — universal recovery discovery across all recovery source kinds.
 * Alias of discoverStagingInitiativePathWarmSources for callers that want the
 * expanded naming; warm/repair runners may use either.
 */
export async function discoverStagingUniversalWarmSources(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<StagingWarmDiscoveryResult> {
  return discoverStagingInitiativePathWarmSources(input);
}

/**
 * Full discovery funnel used by dry-run/execute reporting.
 * Pack 08J.1 — discovers Initiative-path civic families plus blog_post and civic_media.
 */
export async function discoverStagingInitiativePathWarmSources(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<StagingWarmDiscoveryResult> {
  const allowed = new Set<StagingWarmSourceKind>(
    input?.kinds?.length
      ? input.kinds.filter(isWarmKind)
      : [...CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS],
  );

  const listInitiativesFn = input?.deps?.listInitiatives ?? listInitiatives;
  const listApprovedInitiativeCommentsFn =
    input?.deps?.listApprovedInitiativeComments ?? listApprovedInitiativeComments;
  const listPublishedAnalysesByInitiativeFn =
    input?.deps?.listPublishedAnalysesByInitiative ?? listPublishedAnalysesByInitiative;
  const listPetitionsFn = input?.deps?.listPetitions ?? listPetitions;

  const resolveListPublishedBlogPostsForSearch = async () => {
    if (input?.deps?.listPublishedBlogPostsForSearch) {
      return input.deps.listPublishedBlogPostsForSearch;
    }
    const mod = await import("../blog/persistence/blog.repository.js");
    return mod.listPublishedBlogPostsForSearch;
  };
  const resolveListPublicInitiativeImprovementProposals = async () => {
    if (input?.deps?.listPublicInitiativeImprovementProposals) {
      return input.deps.listPublicInitiativeImprovementProposals;
    }
    const mod = await import(
      "../initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js"
    );
    return mod.listPublicInitiativeImprovementProposals;
  };
  const resolveListRevisionsByInitiative = async () => {
    if (input?.deps?.listRevisionsByInitiative) {
      return input.deps.listRevisionsByInitiative;
    }
    const mod = await import(
      "../initiative-version-revision/initiative-version-revision.store.js"
    );
    return mod.listRevisionsByInitiative;
  };
  const resolveListPublicDecisionSessionsForInitiative = async () => {
    if (input?.deps?.listPublicDecisionSessionsForInitiative) {
      return input.deps.listPublicDecisionSessionsForInitiative;
    }
    const mod = await import("../decision-session/public-decision-session.projection.js");
    return mod.listPublicDecisionSessionsForInitiative;
  };
  const resolveListPublicInitiativeCollectiveDecisionsForInitiative = async () => {
    if (input?.deps?.listPublicInitiativeCollectiveDecisionsForInitiative) {
      return input.deps.listPublicInitiativeCollectiveDecisionsForInitiative;
    }
    const mod = await import(
      "../initiative-collective-decision/public-initiative-collective-decision.projection.js"
    );
    return mod.listPublicInitiativeCollectiveDecisionsForInitiative;
  };
  const resolveListPublicInitiativeImplementationCommitmentsForInitiative = async () => {
    if (input?.deps?.listPublicInitiativeImplementationCommitmentsForInitiative) {
      return input.deps.listPublicInitiativeImplementationCommitmentsForInitiative;
    }
    const mod = await import(
      "../initiative-implementation-commitment/public-initiative-implementation-commitment.projection.js"
    );
    return mod.listPublicInitiativeImplementationCommitmentsForInitiative;
  };
  const resolveListPublicInitiativeImplementationTrackingsForInitiative = async () => {
    if (input?.deps?.listPublicInitiativeImplementationTrackingsForInitiative) {
      return input.deps.listPublicInitiativeImplementationTrackingsForInitiative;
    }
    const mod = await import(
      "../initiative-implementation-tracking/public-initiative-implementation-tracking.projection.js"
    );
    return mod.listPublicInitiativeImplementationTrackingsForInitiative;
  };
  const resolveListPublicOfficialResponsesForInitiative = async () => {
    if (input?.deps?.listPublicOfficialResponsesForInitiative) {
      return input.deps.listPublicOfficialResponsesForInitiative;
    }
    const mod = await import("../official-response/official-response.projection.js");
    return mod.listPublicOfficialResponsesForInitiative;
  };
  const resolveListPublicInitiativePublicImpactsForInitiative = async () => {
    if (input?.deps?.listPublicInitiativePublicImpactsForInitiative) {
      return input.deps.listPublicInitiativePublicImpactsForInitiative;
    }
    const mod = await import(
      "../initiative-public-impact/public-initiative-public-impact.projection.js"
    );
    return mod.listPublicInitiativePublicImpactsForInitiative;
  };
  const resolveListPublicCivicArchiveForInitiative = async () => {
    if (input?.deps?.listPublicCivicArchiveForInitiative) {
      return input.deps.listPublicCivicArchiveForInitiative;
    }
    const mod = await import("../public-civic-archive/public-civic-archive.projection.js");
    return mod.listPublicCivicArchiveForInitiative;
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

  const allInitiatives = listInitiativesFn();
  const initiativeScopedKinds: StagingWarmSourceKind[] = [
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
  ];
  if (initiativeScopedKinds.some((kind) => allowed.has(kind))) {
    bumpField("initiative", "sourceRecordsDiscovered", allInitiatives.length);
  }

  const publicInitiatives = allInitiatives.filter(canExposePublicInitiativeProjection);

  let petitionsByInitiative = new Map<string, string[]>();
  if (allowed.has("petition")) {
    try {
      const petitions = await listPetitionsFn();
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

  const listPublicInitiativeImprovementProposalsFn = allowed.has("improvement_proposal")
    ? await resolveListPublicInitiativeImprovementProposals()
    : null;
  const listRevisionsByInitiativeFn = allowed.has("initiative_revision")
    ? await resolveListRevisionsByInitiative()
    : null;
  const listPublicDecisionSessionsForInitiativeFn = allowed.has("decision_session")
    ? await resolveListPublicDecisionSessionsForInitiative()
    : null;
  const listPublicInitiativeCollectiveDecisionsForInitiativeFn = allowed.has(
    "collective_decision",
  )
    ? await resolveListPublicInitiativeCollectiveDecisionsForInitiative()
    : null;
  const listPublicInitiativeImplementationCommitmentsForInitiativeFn = allowed.has(
    "implementation_commitment",
  )
    ? await resolveListPublicInitiativeImplementationCommitmentsForInitiative()
    : null;
  const listPublicInitiativeImplementationTrackingsForInitiativeFn = allowed.has(
    "implementation_tracking",
  )
    ? await resolveListPublicInitiativeImplementationTrackingsForInitiative()
    : null;
  const listPublicOfficialResponsesForInitiativeFn = allowed.has("official_response")
    ? await resolveListPublicOfficialResponsesForInitiative()
    : null;
  const listPublicInitiativePublicImpactsForInitiativeFn = allowed.has("public_impact")
    ? await resolveListPublicInitiativePublicImpactsForInitiative()
    : null;
  const listPublicCivicArchiveForInitiativeFn = allowed.has("civic_archive")
    ? await resolveListPublicCivicArchiveForInitiative()
    : null;

  for (const initiative of publicInitiatives) {
    pushCandidate("initiative", initiative.initiativeId);

    if (allowed.has("discussion_comment")) {
      let offset = 0;
      const limit = 100;
      for (;;) {
        const page = await listApprovedInitiativeCommentsFn({
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
      const analyses = listPublishedAnalysesByInitiativeFn(initiative.initiativeId);
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

    if (allowed.has("improvement_proposal") && listPublicInitiativeImprovementProposalsFn) {
      try {
        const proposals = await listPublicInitiativeImprovementProposalsFn(
          initiative.initiativeId,
        );
        bumpField("improvement_proposal", "sourceRecordsDiscovered", proposals.length);
        for (const proposal of proposals) {
          pushCandidate("improvement_proposal", proposal.proposalId);
        }
      } catch {
        bumpField("improvement_proposal", "sourceRecordsDiscovered", 0);
      }
    }

    if (allowed.has("initiative_revision") && listRevisionsByInitiativeFn) {
      const revisions = listRevisionsByInitiativeFn(initiative.initiativeId);
      bumpField("initiative_revision", "sourceRecordsDiscovered", revisions.length);
      for (const revision of revisions) {
        pushCandidate("initiative_revision", revision.revisionId);
      }
    }

    if (allowed.has("decision_session") && listPublicDecisionSessionsForInitiativeFn) {
      const sessions = listPublicDecisionSessionsForInitiativeFn(initiative.initiativeId);
      bumpField("decision_session", "sourceRecordsDiscovered", sessions.length);
      for (const session of sessions) {
        pushCandidate("decision_session", session.sessionId);
      }
    }

    if (
      allowed.has("collective_decision") &&
      listPublicInitiativeCollectiveDecisionsForInitiativeFn
    ) {
      try {
        const decisions = await listPublicInitiativeCollectiveDecisionsForInitiativeFn(
          initiative.initiativeId,
        );
        bumpField("collective_decision", "sourceRecordsDiscovered", decisions.length);
        for (const decision of decisions) {
          pushCandidate("collective_decision", decision.decisionId);
        }
      } catch {
        bumpField("collective_decision", "sourceRecordsDiscovered", 0);
      }
    }

    if (
      allowed.has("implementation_commitment") &&
      listPublicInitiativeImplementationCommitmentsForInitiativeFn
    ) {
      try {
        const commitments =
          await listPublicInitiativeImplementationCommitmentsForInitiativeFn(
            initiative.initiativeId,
          );
        bumpField("implementation_commitment", "sourceRecordsDiscovered", commitments.length);
        for (const commitment of commitments) {
          pushCandidate("implementation_commitment", commitment.commitmentId);
        }
      } catch {
        bumpField("implementation_commitment", "sourceRecordsDiscovered", 0);
      }
    }

    if (
      allowed.has("implementation_tracking") &&
      listPublicInitiativeImplementationTrackingsForInitiativeFn
    ) {
      try {
        const trackings = await listPublicInitiativeImplementationTrackingsForInitiativeFn(
          initiative.initiativeId,
        );
        bumpField("implementation_tracking", "sourceRecordsDiscovered", trackings.length);
        for (const tracking of trackings) {
          pushCandidate("implementation_tracking", tracking.trackingId);
        }
      } catch {
        bumpField("implementation_tracking", "sourceRecordsDiscovered", 0);
      }
    }

    if (allowed.has("official_response") && listPublicOfficialResponsesForInitiativeFn) {
      const responses = listPublicOfficialResponsesForInitiativeFn(initiative.initiativeId);
      bumpField("official_response", "sourceRecordsDiscovered", responses.length);
      for (const response of responses) {
        pushCandidate("official_response", response.responseId);
      }
    }

    if (
      allowed.has("public_impact") &&
      listPublicInitiativePublicImpactsForInitiativeFn
    ) {
      try {
        const impacts = await listPublicInitiativePublicImpactsForInitiativeFn(
          initiative.initiativeId,
        );
        bumpField("public_impact", "sourceRecordsDiscovered", impacts.length);
        for (const impact of impacts) {
          pushCandidate("public_impact", impact.impactId);
        }
      } catch {
        bumpField("public_impact", "sourceRecordsDiscovered", 0);
      }
    }

    if (allowed.has("civic_archive") && listPublicCivicArchiveForInitiativeFn) {
      const archives = listPublicCivicArchiveForInitiativeFn(initiative.initiativeId);
      bumpField("civic_archive", "sourceRecordsDiscovered", archives.length);
      for (const archive of archives) {
        pushCandidate("civic_archive", archive.archiveRecordId);
      }
    }
  }

  if (allowed.has("blog_post")) {
    try {
      const listPublishedBlogPostsForSearchFn =
        await resolveListPublishedBlogPostsForSearch();
      const posts = await listPublishedBlogPostsForSearchFn();
      bumpField("blog_post", "sourceRecordsDiscovered", posts.length);
      for (const post of posts) {
        pushCandidate("blog_post", post.postId);
      }
    } catch {
      bumpField("blog_post", "sourceRecordsDiscovered", 0);
    }
  }

  if (allowed.has("civic_media")) {
    const civicMediaIds = discoverCivicMediaTranslationRecordIds();
    bumpField("civic_media", "sourceRecordsDiscovered", civicMediaIds.length);
    for (const recordId of civicMediaIds) {
      pushCandidate("civic_media", recordId);
    }
  }

  const hintParts: string[] = [];
  if (allInitiatives.length === 0 && initiativeScopedKinds.some((kind) => allowed.has(kind))) {
    hintParts.push(
      "SOURCE_RECORDS_DISCOVERED.initiative=0 — Mongo snapshot stores may be unhydrated or unsynced. Call bootstrapContentTranslationOperatorPersistence() (hydrate + syncInitiativeStoreAfterMongoHydrate) before warm enumeration.",
    );
  }
  if (
    allowed.has("blog_post") &&
    (discovery.get("blog_post")?.sourceRecordsDiscovered ?? 0) === 0 &&
    (discovery.get("blog_post")?.publicRecords ?? 0) === 0
  ) {
    hintParts.push(
      "SOURCE_RECORDS_DISCOVERED.blog_post=0 — published blog posts unavailable or empty (Mongo blog_posts not ready, or no published posts).",
    );
  }

  return {
    candidates: out,
    discoveryByKind: discovery,
    discoveryHint: hintParts.length > 0 ? hintParts.join(" ") : null,
  };
}

/**
 * Dry-run or enqueue warm requests for recovery-path public records.
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
