import type { CivicEntityType, CivicSearchMetadata } from "@hu/types";

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
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
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
import { enrichSearchEntryWithMultilingual } from "./global-search-multilingual.js";

interface SearchEntityRef {
  entityType: CivicEntityType;
  entityId: string;
}

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

export function isPublicInitiative(initiativeId: string): boolean {
  const initiative = getInitiativeById(initiativeId);
  return initiative != null && isInitiativeEligibleForPublicProjection(initiative);
}

const INITIATIVE_OWNED_SEARCH_TYPES = new Set<CivicEntityType>([
  "initiative",
  "analysis",
  "improvement_proposal",
  "initiative_revision",
  "petition",
  "decision_session",
  "collective_decision",
  "civic_action_package",
  "official_response",
  "civic_accountability",
  "implementation_commitment",
  "implementation_tracking",
  "public_impact",
  "civic_archive",
]);

/**
 * Read-time gate for a warm search index. Index build also uses this rule,
 * and a block drops the cache, but a stale entry must not be returned.
 */
export function isSearchIndexEntryOrdinaryPublic(
  entry: Pick<GlobalSearchIndexEntry, "entityType" | "entityId" | "initiativeId">,
): boolean {
  if (!INITIATIVE_OWNED_SEARCH_TYPES.has(entry.entityType)) {
    return true;
  }

  const initiativeId = entry.entityType === "initiative" ? entry.entityId : entry.initiativeId;
  return typeof initiativeId === "string" && isPublicInitiative(initiativeId);
}

function buildNormalizedMultilingualMaps(metadata: CivicSearchMetadata): {
  normalizedTranslatedTitles: Record<string, string>;
  normalizedTranslatedSummaries: Record<string, string>;
  normalizedTerminologyAliasesByLanguage: Record<string, readonly string[]>;
} {
  const normalizedTranslatedTitles: Record<string, string> = {};
  const normalizedTranslatedSummaries: Record<string, string> = {};
  const terminologyBuckets = new Map<string, Set<string>>();

  for (const field of metadata.translatedFields ?? []) {
    if (field.freshness !== "current") {
      continue;
    }
    if (field.title) {
      normalizedTranslatedTitles[field.language] = normalizeField(field.title);
    }
    if (field.summary) {
      normalizedTranslatedSummaries[field.language] = normalizeField(field.summary);
    }
  }

  for (const alias of metadata.terminologyAliases ?? []) {
    const bucket = terminologyBuckets.get(alias.language) ?? new Set<string>();
    bucket.add(normalizeField(alias.term));
    terminologyBuckets.set(alias.language, bucket);
  }

  const normalizedTerminologyAliasesByLanguage: Record<string, readonly string[]> = {};
  for (const [language, terms] of terminologyBuckets.entries()) {
    normalizedTerminologyAliasesByLanguage[language] = [...terms].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  return {
    normalizedTranslatedTitles,
    normalizedTranslatedSummaries,
    normalizedTerminologyAliasesByLanguage,
  };
}

async function toIndexEntry(
  metadata: NonNullable<Awaited<ReturnType<typeof buildSearchMetadata>>>,
): Promise<GlobalSearchIndexEntry> {
  let enriched: CivicSearchMetadata = metadata;

  try {
    enriched = await enrichSearchEntryWithMultilingual(metadata);
  } catch {
    // Soft-fail enrichment — keep the canonical entry searchable.
    enriched = metadata;
  }

  const multilingual = buildNormalizedMultilingualMaps(enriched);

  return {
    ...enriched,
    normalizedTitle: normalizeField(enriched.title),
    normalizedSummary: normalizeField(enriched.summary),
    normalizedCountry: normalizeField(enriched.country),
    normalizedRegion: normalizeField(enriched.region),
    normalizedCommunity: normalizeField(enriched.community),
    normalizedActivityArea: normalizeField(enriched.activityArea),
    normalizedStatus: normalizeField(enriched.status),
    normalizedEntityType: normalizeField(enriched.entityType),
    normalizedCountryLabel: normalizeField(enriched.countryLabel ?? ""),
    normalizedRegionLabel: normalizeField(enriched.regionLabel ?? ""),
    normalizedCountryCode: normalizeField(enriched.countryCode ?? ""),
    normalizedRegionCode: normalizeField(enriched.regionCode ?? ""),
    ...multilingual,
  };
}

async function collectSearchEntityRefs(): Promise<SearchEntityRef[]> {
  const refs: SearchEntityRef[] = [];

  for (const initiative of listInitiatives()) {
    if (!isPublicInitiative(initiative.initiativeId)) {
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
let searchInvalidationCountForTests = 0;

export function resetGlobalSearchInvalidationCountForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Search invalidation counters are available only when NODE_TEST_ENV=true.");
  }
  searchInvalidationCountForTests = 0;
}

export function globalSearchInvalidationCountForTests(): number {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Search invalidation counters are available only when NODE_TEST_ENV=true.");
  }
  return searchInvalidationCountForTests;
}

export async function buildGlobalSearchIndex(): Promise<GlobalSearchIndexEntry[]> {
  const entries: GlobalSearchIndexEntry[] = [];

  for (const ref of await collectSearchEntityRefs()) {
    const metadata = await buildSearchMetadata(ref.entityType, ref.entityId);

    if (!metadata) {
      continue;
    }

    entries.push(await toIndexEntry(metadata));
  }

  for (const article of getKnowledgeArticleRecordsForSearch()) {
    entries.push(await toIndexEntry(knowledgeArticleToSearchMetadata(article)));
  }

  for (const mediaRecord of await getCivicMediaRecordsForSearch()) {
    entries.push(await toIndexEntry(civicMediaToSearchMetadata(mediaRecord)));
  }

  for (const nomination of listPublishedCivicNominations()) {
    const metadata = civicNominationToSearchMetadata(nomination);

    if (metadata) {
      entries.push(await toIndexEntry(metadata));
    }
  }

  try {
    for (const post of await listPublishedBlogPostsForSearch()) {
      const metadata = blogPostToSearchMetadata(post);
      if (metadata) {
        entries.push(await toIndexEntry(metadata));
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

export function setGlobalSearchIndexForTests(entries: GlobalSearchIndexEntry[]): void {
  cachedIndex = entries;
}

export function invalidateGlobalSearchIndex(): void {
  cachedIndex = null;
  if (process.env.NODE_TEST_ENV === "true") {
    searchInvalidationCountForTests += 1;
  }
}
