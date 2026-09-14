/**
 * Step 06C.2B — enumerate Search-discovery warm targets for supported CT kinds.
 *
 * Supported kinds are derived from CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS
 * (civic_media excluded). Record filters align with Global Search inclusion
 * where practical; CT sourceRecordId identity is used for warm/load (e.g.
 * initiative_revision uses revisionId, not Search's initiativeId::version).
 */

import type { ContentTranslationSourceKind } from "@hu/types";

import { listAnalyses } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listDecisions } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listSessions } from "../decision-session/decision-session.store.js";
import { listCommitments } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackings } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { listImpacts } from "../initiative-public-impact/initiative-public-impact.store.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { listResponses } from "../official-response/official-response.store.js";
import { listPublishedArchiveRecords } from "../public-civic-archive/public-civic-archive.store.js";
import { listPetitions } from "../petition/petition.store.js";
import {
  CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS,
  type SearchDiscoveryMappedSourceKind,
} from "./content-translation-search-discovery-fields.js";

export interface SearchDiscoveryWarmTarget {
  readonly sourceKind: SearchDiscoveryMappedSourceKind;
  readonly sourceRecordId: string;
}

function isPublicInitiative(initiativeId: string): boolean {
  const initiative = getInitiativeById(initiativeId);
  return initiative !== undefined && initiative !== null && initiative.lifecyclePhase !== "draft";
}

/** Deterministic ordered list of discovery-mapped sourceKinds (excludes civic_media). */
export function listSearchDiscoveryMappedSourceKinds(): readonly SearchDiscoveryMappedSourceKind[] {
  return (Object.keys(CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS) as SearchDiscoveryMappedSourceKind[])
    .slice()
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Enumerate searchable/public records for Search discovery warm enqueue.
 * Soft-fails per kind when a store/projection is unavailable (e.g. Blog Mongo).
 */
export async function listSearchDiscoveryWarmTargets(): Promise<
  readonly SearchDiscoveryWarmTarget[]
> {
  const out: SearchDiscoveryWarmTarget[] = [];
  const seen = new Set<string>();
  const push = (sourceKind: SearchDiscoveryMappedSourceKind, sourceRecordId: string) => {
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

  const kinds = new Set(listSearchDiscoveryMappedSourceKinds());

  if (kinds.has("initiative")) {
    for (const initiative of listInitiatives()) {
      if (initiative.lifecyclePhase === "draft") {
        continue;
      }
      push("initiative", initiative.initiativeId);
    }
  }

  if (kinds.has("collaborative_analysis")) {
    for (const analysis of listAnalyses()) {
      if (analysis.status !== "published" || !isPublicInitiative(analysis.initiativeId)) {
        continue;
      }
      push("collaborative_analysis", analysis.analysisId);
    }
  }

  if (kinds.has("initiative_revision")) {
    for (const initiative of listInitiatives()) {
      if (initiative.lifecyclePhase === "draft") {
        continue;
      }
      for (const revision of listRevisionsByInitiative(initiative.initiativeId)) {
        // CT loader identity is revisionId (Search index uses initiativeId::version).
        push("initiative_revision", revision.revisionId);
      }
    }
  }

  if (kinds.has("decision_session")) {
    for (const session of listSessions()) {
      if (session.status === "draft" || !isPublicInitiative(session.initiativeId)) {
        continue;
      }
      push("decision_session", session.sessionId);
    }
  }

  if (kinds.has("collective_decision")) {
    for (const decision of listDecisions()) {
      if (decision.status === "draft" || !isPublicInitiative(decision.initiativeId)) {
        continue;
      }
      push("collective_decision", decision.decisionId);
    }
  }

  if (kinds.has("petition")) {
    try {
      for (const petition of await listPetitions()) {
        if (
          !["Open", "Published", "Closed", "Archived"].includes(petition.status) ||
          !isPublicInitiative(petition.subject.initiativeId)
        ) {
          continue;
        }
        push("petition", petition.petitionId);
      }
    } catch {
      // Petition store unavailable in some test modes.
    }
  }

  if (kinds.has("implementation_commitment")) {
    for (const commitment of listCommitments()) {
      if (commitment.status !== "published" || !isPublicInitiative(commitment.initiativeId)) {
        continue;
      }
      push("implementation_commitment", commitment.commitmentId);
    }
  }

  if (kinds.has("implementation_tracking")) {
    for (const tracking of listTrackings()) {
      if (
        !["active", "completed", "archived"].includes(tracking.status) ||
        !isPublicInitiative(tracking.initiativeId)
      ) {
        continue;
      }
      push("implementation_tracking", tracking.trackingId);
    }
  }

  if (kinds.has("official_response")) {
    for (const response of listResponses()) {
      if (
        response.publicationStatus !== "published" ||
        !isPublicInitiative(response.initiativeId)
      ) {
        continue;
      }
      push("official_response", response.responseId);
    }
  }

  if (kinds.has("public_impact")) {
    for (const impact of listImpacts()) {
      if (
        !["published", "verified"].includes(impact.status) ||
        !isPublicInitiative(impact.initiativeId)
      ) {
        continue;
      }
      push("public_impact", impact.impactId);
    }
  }

  if (kinds.has("civic_archive")) {
    for (const archive of listPublishedArchiveRecords()) {
      if (!isPublicInitiative(archive.initiativeId)) {
        continue;
      }
      push("civic_archive", archive.archiveRecordId);
    }
  }

  // Prefer Part D CT-eligible proposals (Search Cap02 listProposals may include
  // records the CT loader rejects — warm would no-op / skip).
  if (kinds.has("improvement_proposal")) {
    try {
      const { listPublishedImprovementProposalIdsPage } = await import(
        "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js"
      );
      const { IMPROVEMENT_PROPOSAL_WARM_COLLECTION_PAGE_SIZE } = await import(
        "../initiative-improvement-proposals-stage/extract-public-improvement-proposal-ids.js"
      );
      let offset = 0;
      for (;;) {
        const page = await listPublishedImprovementProposalIdsPage({
          limit: IMPROVEMENT_PROPOSAL_WARM_COLLECTION_PAGE_SIZE,
          offset,
        });
        for (const proposalId of page.proposalIds) {
          push("improvement_proposal", proposalId);
        }
        if (!page.hasMore || page.collectionsReturned === 0) {
          break;
        }
        offset += page.collectionsReturned;
      }
    } catch {
      // Part D store unavailable.
    }
  }

  if (kinds.has("blog_post")) {
    try {
      const { listPublishedBlogPostsForSearch } = await import("../blog/blog.service.js");
      const posts = await listPublishedBlogPostsForSearch();
      for (const post of posts) {
        push("blog_post", post.postId);
      }
    } catch {
      // Blog Mongo unavailable in some test/bootstrap modes.
    }
  }

  out.sort((left, right) => {
    const kindCmp = left.sourceKind.localeCompare(right.sourceKind);
    if (kindCmp !== 0) {
      return kindCmp;
    }
    return left.sourceRecordId.localeCompare(right.sourceRecordId);
  });

  return out;
}

/** Guard: civic_media must never appear in discovery warm targets. */
export function assertCivicMediaExcludedFromSearchDiscoveryWarm(
  targets: readonly { readonly sourceKind: ContentTranslationSourceKind }[],
): void {
  for (const row of targets) {
    if (row.sourceKind === "civic_media") {
      throw new Error("civic_media must not be scheduled for Search discovery warm.");
    }
  }
}
