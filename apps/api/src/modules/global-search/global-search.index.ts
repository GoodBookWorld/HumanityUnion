import type { CivicEntityType } from "@hu/types";

import { buildSearchMetadata } from "../capability02-integration/capability02-integration.service.js";
import { listAccountabilities } from "../civic-accountability/civic-accountability.store.js";
import { listCaps } from "../civic-action-package/civic-action-package.store.js";
import { listSessions } from "../decision-session/decision-session.store.js";
import { listAnalyses } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listDecisions } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import { listCommitments } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackings } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { listProposals } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { listImpacts } from "../initiative-public-impact/initiative-public-impact.store.js";
import { listRevisionsByInitiative } from "../initiative-version-revision/initiative-version-revision.store.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { listResponses } from "../official-response/official-response.store.js";
import { listPublishedArchiveRecords } from "../public-civic-archive/public-civic-archive.store.js";
import type { GlobalSearchIndexEntry } from "./global-search.types.js";
import { knowledgeArticleToSearchMetadata } from "../knowledge-center/knowledge-center.projection.js";
import { getKnowledgeArticleRecordsForSearch } from "../knowledge-center/knowledge-center.service.js";
import { civicMediaToSearchMetadata } from "../civic-media-center/civic-media-center.projection.js";
import { getCivicMediaRecordsForSearch } from "../civic-media-center/civic-media-center.service.js";
import { civicNominationToSearchMetadata } from "../civic-nomination/civic-nomination.projection.js";
import { listPublishedCivicNominations } from "../civic-nomination/civic-nomination.store.js";
import { listPetitions } from "../petition/petition.store.js";
import { blogPostToSearchMetadata } from "../blog/blog.projection.js";
import { listPublishedBlogPostsForSearch } from "../blog/blog.service.js";

interface SearchEntityRef {
  entityType: CivicEntityType;
  entityId: string;
}

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

function isPublicInitiative(initiativeId: string): boolean {
  const initiative = getInitiativeById(initiativeId);
  return initiative !== undefined && initiative !== null && initiative.lifecyclePhase !== "draft";
}

function toIndexEntry(
  metadata: NonNullable<Awaited<ReturnType<typeof buildSearchMetadata>>>,
): GlobalSearchIndexEntry {
  return {
    ...metadata,
    normalizedTitle: normalizeField(metadata.title),
    normalizedSummary: normalizeField(metadata.summary),
    normalizedCountry: normalizeField(metadata.country),
    normalizedRegion: normalizeField(metadata.region),
    normalizedCommunity: normalizeField(metadata.community),
    normalizedActivityArea: normalizeField(metadata.activityArea),
    normalizedStatus: normalizeField(metadata.status),
    normalizedEntityType: normalizeField(metadata.entityType),
    normalizedCountryLabel: normalizeField(metadata.countryLabel ?? ""),
    normalizedRegionLabel: normalizeField(metadata.regionLabel ?? ""),
    normalizedCountryCode: normalizeField(metadata.countryCode ?? ""),
    normalizedRegionCode: normalizeField(metadata.regionCode ?? ""),
  };
}

async function collectSearchEntityRefs(): Promise<SearchEntityRef[]> {
  const refs: SearchEntityRef[] = [];

  for (const initiative of listInitiatives()) {
    if (initiative.lifecyclePhase === "draft") {
      continue;
    }

    refs.push({ entityType: "initiative", entityId: initiative.initiativeId });
  }

  for (const analysis of listAnalyses()) {
    if (analysis.status !== "published" || !isPublicInitiative(analysis.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "analysis", entityId: analysis.analysisId });
  }

  for (const proposal of listProposals()) {
    if (proposal.status === "draft" || !isPublicInitiative(proposal.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "improvement_proposal", entityId: proposal.proposalId });
  }

  for (const initiative of listInitiatives()) {
    if (initiative.lifecyclePhase === "draft") {
      continue;
    }

    for (const revision of listRevisionsByInitiative(initiative.initiativeId)) {
      refs.push({
        entityType: "initiative_revision",
        entityId: `${initiative.initiativeId}::${revision.version}`,
      });
    }
  }

  for (const session of listSessions()) {
    if (session.status === "draft" || !isPublicInitiative(session.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "decision_session", entityId: session.sessionId });
  }

  for (const decision of listDecisions()) {
    if (decision.status === "draft" || !isPublicInitiative(decision.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "collective_decision", entityId: decision.decisionId });
  }

  for (const petition of await listPetitions()) {
    if (
      !["Open", "Published", "Closed", "Archived"].includes(petition.status) ||
      !isPublicInitiative(petition.subject.initiativeId)
    ) {
      continue;
    }

    refs.push({ entityType: "petition", entityId: petition.petitionId });
  }

  for (const cap of listCaps()) {
    if (cap.status !== "issued" || !isPublicInitiative(cap.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "civic_action_package", entityId: cap.capId });
  }

  for (const response of listResponses()) {
    if (response.publicationStatus !== "published" || !isPublicInitiative(response.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "official_response", entityId: response.responseId });
  }

  for (const accountability of listAccountabilities()) {
    if (!isPublicInitiative(accountability.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "civic_accountability", entityId: accountability.accountabilityId });
  }

  for (const commitment of listCommitments()) {
    if (commitment.status !== "published" || !isPublicInitiative(commitment.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "implementation_commitment", entityId: commitment.commitmentId });
  }

  for (const tracking of listTrackings()) {
    if (
      !["active", "completed", "archived"].includes(tracking.status) ||
      !isPublicInitiative(tracking.initiativeId)
    ) {
      continue;
    }

    refs.push({ entityType: "implementation_tracking", entityId: tracking.trackingId });
  }

  for (const impact of listImpacts()) {
    if (
      !["published", "verified"].includes(impact.status) ||
      !isPublicInitiative(impact.initiativeId)
    ) {
      continue;
    }

    refs.push({ entityType: "public_impact", entityId: impact.impactId });
  }

  for (const archive of listPublishedArchiveRecords()) {
    if (!isPublicInitiative(archive.initiativeId)) {
      continue;
    }

    refs.push({ entityType: "civic_archive", entityId: archive.archiveRecordId });
  }

  return refs;
}

let cachedIndex: GlobalSearchIndexEntry[] | null = null;

export async function buildGlobalSearchIndex(): Promise<GlobalSearchIndexEntry[]> {
  const entries: GlobalSearchIndexEntry[] = [];

  for (const ref of await collectSearchEntityRefs()) {
    const metadata = await buildSearchMetadata(ref.entityType, ref.entityId);

    if (!metadata) {
      continue;
    }

    entries.push(toIndexEntry(metadata));
  }

  for (const article of getKnowledgeArticleRecordsForSearch()) {
    entries.push(toIndexEntry(knowledgeArticleToSearchMetadata(article)));
  }

  for (const mediaRecord of getCivicMediaRecordsForSearch()) {
    entries.push(toIndexEntry(civicMediaToSearchMetadata(mediaRecord)));
  }

  for (const nomination of listPublishedCivicNominations()) {
    const metadata = civicNominationToSearchMetadata(nomination);

    if (metadata) {
      entries.push(toIndexEntry(metadata));
    }
  }

  try {
    for (const post of await listPublishedBlogPostsForSearch()) {
      const metadata = blogPostToSearchMetadata(post);
      if (metadata) {
        entries.push(toIndexEntry(metadata));
      }
    }
  } catch {
    // Blog Mongo unavailable in some test/bootstrap modes — skip Blog index entries.
  }

  return entries.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export async function getGlobalSearchIndex(): Promise<GlobalSearchIndexEntry[]> {
  if (!cachedIndex) {
    cachedIndex = await buildGlobalSearchIndex();
  }

  return cachedIndex;
}

export function resetGlobalSearchIndexForTests(): void {
  cachedIndex = null;
}

export function invalidateGlobalSearchIndex(): void {
  cachedIndex = null;
}
