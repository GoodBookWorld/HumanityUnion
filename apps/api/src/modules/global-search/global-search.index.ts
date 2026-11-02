import {
  normalizeLanguageRegistryLocaleKey,
  type CivicEntityType,
  type CivicSearchMetadata,
  type LanguageRegistryRecord,
  type TerminologyConcept,
} from "@hu/types";

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
import { listLanguageRegistry } from "../language/language-registry/language-registry.repository.js";
import { listTerminologyConcepts } from "../language/terminology-glossary/terminology-glossary.repository.js";
import {
  enrichSearchEntryWithMultilingual,
  isSearchEnabledRecord,
  type GlobalSearchMultilingualDeps,
} from "./global-search-multilingual.js";

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

export interface GlobalSearchBuildLookups {
  readonly listLanguageRegistry: () => Promise<readonly LanguageRegistryRecord[]>;
  readonly listTerminologyConcepts: () => Promise<readonly TerminologyConcept[]>;
}

const DEFAULT_BUILD_LOOKUPS: GlobalSearchBuildLookups = {
  listLanguageRegistry,
  listTerminologyConcepts,
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

function unwrap<T>(result: Settled<T>): T {
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

/**
 * REGION-500B.P2 — one language registry and one terminology glossary read per
 * index build, shared by every entry; translation target locales resolve against
 * that registry in memory (same locale/alias keys as resolveLanguageRegistryLocale).
 * A failed read keeps the existing per-entry soft-fail: entries stay canonical-only.
 */
export async function createGlobalSearchBuildMultilingualDeps(
  lookups: GlobalSearchBuildLookups = DEFAULT_BUILD_LOOKUPS,
): Promise<GlobalSearchMultilingualDeps> {
  const [registry, concepts] = await Promise.all([
    settle(lookups.listLanguageRegistry()),
    settle(lookups.listTerminologyConcepts()),
  ]);

  const byLocaleKey = new Map<string, LanguageRegistryRecord>();
  if (registry.ok) {
    for (const record of registry.value) {
      const key = normalizeLanguageRegistryLocaleKey(record.locale);
      if (!byLocaleKey.has(key)) {
        byLocaleKey.set(key, record);
      }
    }
    for (const record of registry.value) {
      for (const alias of record.aliases ?? []) {
        const key = normalizeLanguageRegistryLocaleKey(alias);
        if (!byLocaleKey.has(key)) {
          byLocaleKey.set(key, record);
        }
      }
    }
  }

  return {
    listSearchEnabledLanguages: async () => unwrap(registry).filter(isSearchEnabledRecord),
    resolveLocale: async (localeOrAlias) => {
      unwrap(registry);
      const key = normalizeLanguageRegistryLocaleKey(localeOrAlias);
      return key ? (byLocaleKey.get(key) ?? null) : null;
    },
    listTerminologyConcepts: async () => unwrap(concepts),
  };
}

async function toIndexEntry(
  metadata: NonNullable<Awaited<ReturnType<typeof buildSearchMetadata>>>,
  multilingualDeps: GlobalSearchMultilingualDeps,
): Promise<GlobalSearchIndexEntry> {
  let enriched: CivicSearchMetadata = metadata;

  try {
    enriched = await enrichSearchEntryWithMultilingual(metadata, multilingualDeps);
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

/** Entries are valid only for the generation they were built in. */
let cachedIndex: { generation: number; entries: GlobalSearchIndexEntry[] } | null = null;
/** Incremented by every invalidation. */
let indexGeneration = 0;
let inFlightBuild: { generation: number; promise: Promise<GlobalSearchIndexEntry[]> } | null = null;
let buildIndexForGetter: () => Promise<GlobalSearchIndexEntry[]> = () => buildGlobalSearchIndex();
let searchInvalidationCountForTests = 0;

/**
 * A waiting request rebuilds at most this many times when invalidations keep
 * landing during its builds, then fails instead of returning an obsolete index.
 */
export const GLOBAL_SEARCH_INDEX_MAX_BUILD_ATTEMPTS = 3;

export class GlobalSearchIndexUnstableError extends Error {
  constructor() {
    super("Global search index was invalidated during every rebuild attempt.");
    this.name = "GlobalSearchIndexUnstableError";
  }
}

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

export async function buildGlobalSearchIndex(
  lookups: GlobalSearchBuildLookups = DEFAULT_BUILD_LOOKUPS,
): Promise<GlobalSearchIndexEntry[]> {
  const entries: GlobalSearchIndexEntry[] = [];
  const multilingualDeps = await createGlobalSearchBuildMultilingualDeps(lookups);

  for (const ref of await collectSearchEntityRefs()) {
    const metadata = await buildSearchMetadata(ref.entityType, ref.entityId);

    if (!metadata) {
      continue;
    }

    entries.push(await toIndexEntry(metadata, multilingualDeps));
  }

  for (const article of getKnowledgeArticleRecordsForSearch()) {
    entries.push(await toIndexEntry(knowledgeArticleToSearchMetadata(article), multilingualDeps));
  }

  for (const mediaRecord of await getCivicMediaRecordsForSearch()) {
    entries.push(await toIndexEntry(civicMediaToSearchMetadata(mediaRecord), multilingualDeps));
  }

  for (const nomination of listPublishedCivicNominations()) {
    const metadata = civicNominationToSearchMetadata(nomination);

    if (metadata) {
      entries.push(await toIndexEntry(metadata, multilingualDeps));
    }
  }

  try {
    for (const post of await listPublishedBlogPostsForSearch()) {
      const metadata = blogPostToSearchMetadata(post);
      if (metadata) {
        entries.push(await toIndexEntry(metadata, multilingualDeps));
      }
    }
  } catch {
    // Blog Mongo unavailable in some test/bootstrap modes — skip Blog index entries.
  }

  return entries.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

/** Starts a build for the current generation, or joins the one already running for it. */
function joinBuildForCurrentGeneration(): { generation: number; promise: Promise<GlobalSearchIndexEntry[]> } {
  const generation = indexGeneration;

  if (inFlightBuild?.generation === generation) {
    return inFlightBuild;
  }

  const build = { generation, promise: buildIndexForGetter() };
  inFlightBuild = build;

  build.promise.then(
    (entries) => {
      // Publish only if nothing was invalidated while this build ran.
      if (indexGeneration === generation) {
        cachedIndex = { generation, entries };
      }
    },
    () => {
      // A failed build is not cached; the next request starts a new one.
    },
  );
  void build.promise
    .finally(() => {
      if (inFlightBuild === build) {
        inFlightBuild = null;
      }
    })
    .catch(() => {});

  return build;
}

/**
 * REGION-500B.P2 — concurrent callers share one build per index generation. A
 * build that was invalidated before it finished is never cached or returned; the
 * caller rebuilds (bounded by GLOBAL_SEARCH_INDEX_MAX_BUILD_ATTEMPTS).
 */
export async function getGlobalSearchIndex(): Promise<GlobalSearchIndexEntry[]> {
  for (let attempt = 0; attempt < GLOBAL_SEARCH_INDEX_MAX_BUILD_ATTEMPTS; attempt += 1) {
    if (cachedIndex && cachedIndex.generation === indexGeneration) {
      return cachedIndex.entries;
    }

    const build = joinBuildForCurrentGeneration();
    const entries = await build.promise;

    if (build.generation === indexGeneration) {
      return entries;
    }
  }

  throw new GlobalSearchIndexUnstableError();
}

export function resetGlobalSearchIndexForTests(): void {
  cachedIndex = null;
  inFlightBuild = null;
  buildIndexForGetter = () => buildGlobalSearchIndex();
}

export function setGlobalSearchIndexForTests(entries: GlobalSearchIndexEntry[]): void {
  cachedIndex = { generation: indexGeneration, entries };
}

/** Replaces the builder used by getGlobalSearchIndex (null restores the real build). */
export function setGlobalSearchIndexBuilderForTests(
  builder: (() => Promise<GlobalSearchIndexEntry[]>) | null,
): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("The search index builder can be replaced only when NODE_TEST_ENV=true.");
  }
  cachedIndex = null;
  inFlightBuild = null;
  buildIndexForGetter = builder ?? (() => buildGlobalSearchIndex());
}

export function invalidateGlobalSearchIndex(): void {
  indexGeneration += 1;
  cachedIndex = null;
  if (process.env.NODE_TEST_ENV === "true") {
    searchInvalidationCountForTests += 1;
  }
}
