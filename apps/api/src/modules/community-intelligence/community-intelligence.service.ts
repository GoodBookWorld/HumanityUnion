import type {
  CommunityCollaborationOpportunityProjection,
  CommunityInitiativeRelationshipProjection,
  CommunityIntelligenceAssistantContext,
  CommunityParticipantRelevanceProjection,
  CommunityRelatedInitiativesResponse,
  CommunitySimilarityCheckRequest,
  CommunitySimilarityCheckResponse,
  CommunityWorkspaceOpportunitiesResponse,
  Initiative,
  MemberProfile,
} from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OTHER } from "@hu/types";

import { publicUrlForEntity } from "../capability02-integration/capability02-integration.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { listPublicInitiativeCollaborativeAnalyses } from "../initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { resolvePublicAuthorsForParticipantIds } from "../initiative-discussion-collaboration/public-participant-identity.projection.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import {
  isMemberProfileFieldVisible,
  toPublicMemberProfile,
} from "../member-profile/member-profile.projection.js";
import { getPreferencesByMemberId } from "../preferences/index.js";

import type { CommunityInitiativeSignalDocument } from "./community-similarity-provider.js";
import {
  COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
  COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
  COMMUNITY_INTELLIGENCE_EMPTY_COLLABORATION,
  COMMUNITY_INTELLIGENCE_EMPTY_OVERLAP,
  COMMUNITY_INTELLIGENCE_EMPTY_RELATED,
  COMMUNITY_INTELLIGENCE_MAX_PARTICIPANTS,
  COMMUNITY_INTELLIGENCE_MAX_RELATED,
  COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS,
  COMMUNITY_INTELLIGENCE_MIN_SCORE,
  COMMUNITY_INTELLIGENCE_STRONG_OVERLAP_SCORE,
  COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
} from "./community-intelligence.constants.js";
import {
  clearCommunityIntelligenceCacheForTests,
  getCommunityIntelligenceCacheEntry,
  invalidateCommunityIntelligenceCache,
  isCommunityIntelligenceCacheEntryFresh,
  setCommunityIntelligenceCacheEntry,
} from "./community-intelligence-cache.js";
import {
  resolveInitiativeActivityArea,
  scorePriorityMatches,
  selectCandidateInitiatives as selectCandidateInitiativesFromPool,
} from "./community-intelligence-matching.js";
import { resolveCommunitySimilarityProvider } from "./resolve-community-similarity-provider.js";
import { tokenizeCommunityText } from "./text-signals.js";

export {
  formatCommunityIntelligenceForAssistantPrompt,
  instructionsRequestCommunityIntelligence,
  scorePriorityMatches,
} from "./community-intelligence-matching.js";

export { invalidateCommunityIntelligenceCache, clearCommunityIntelligenceCacheForTests };

function resolveActivityArea(initiative: Initiative): string {
  return resolveInitiativeActivityArea(initiative);
}

export function selectCandidateInitiatives(
  source: Pick<Initiative, "initiativeId" | "metadata">,
  all: readonly Initiative[] = listInitiatives(),
): Initiative[] {
  return selectCandidateInitiativesFromPool(source, all);
}

function toSignalDocument(
  initiative: Initiative,
  publicAnalysisThemes: readonly string[] = [],
): CommunityInitiativeSignalDocument {
  const activityArea = resolveActivityArea(initiative);

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    description: initiative.description,
    activityArea,
    tags: initiative.metadata.tags ?? [],
    category: initiative.metadata.category || activityArea,
    countrySlug: initiative.metadata.countrySlug,
    regionSlug: initiative.metadata.regionSlug,
    communitySlug: initiative.metadata.communitySlug,
    participationScope: initiative.metadata.participationScope,
    publicAnalysisThemes,
    publicUrl: publicUrlForEntity("initiative", initiative.initiativeId),
  };
}

async function loadPublicAnalysisThemes(initiativeId: string): Promise<string[]> {
  try {
    const analyses = await listPublicInitiativeCollaborativeAnalyses(initiativeId);
    const themes: string[] = [];

    for (const analysis of analyses.slice(0, 3)) {
      if (analysis.title) {
        themes.push(analysis.title);
      }
      if (analysis.summary) {
        themes.push(analysis.summary);
      }
    }

    return themes;
  } catch {
    return [];
  }
}

async function buildSignalsForCandidates(
  candidates: readonly Initiative[],
): Promise<CommunityInitiativeSignalDocument[]> {
  // Bounded parallel theme loads — candidate set already capped.
  const themes = await Promise.all(
    candidates.map((initiative) => loadPublicAnalysisThemes(initiative.initiativeId)),
  );

  return candidates.map((initiative, index) =>
    toSignalDocument(initiative, themes[index] ?? []),
  );
}

export async function findRelatedInitiativesForInitiative(
  initiativeId: string,
  options: { readonly bypassCache?: boolean } = {},
): Promise<CommunityRelatedInitiativesResponse> {
  const initiative = getInitiativeById(initiativeId);
  const generatedAt = new Date().toISOString();
  const provider = resolveCommunitySimilarityProvider();

  if (!initiative || !isInitiativeEligibleForPublicProjection(initiative)) {
    return {
      sourceInitiativeId: initiativeId,
      items: [],
      emptyMessage: COMMUNITY_INTELLIGENCE_EMPTY_RELATED,
      audience: "public",
      providerId: provider.providerId,
      generatedAt,
      algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
    };
  }

  const cached = getCommunityIntelligenceCacheEntry(initiativeId);
  if (!options.bypassCache && isCommunityIntelligenceCacheEntryFresh(cached)) {
    return {
      sourceInitiativeId: initiativeId,
      items: cached.items,
      emptyMessage: COMMUNITY_INTELLIGENCE_EMPTY_RELATED,
      audience: "public",
      providerId: cached.providerId,
      generatedAt,
      algorithmVersion: cached.algorithmVersion,
    };
  }

  const sourceThemes = await loadPublicAnalysisThemes(initiativeId);
  const source = toSignalDocument(initiative, sourceThemes);
  const candidates = selectCandidateInitiatives(initiative);
  const candidateSignals = await buildSignalsForCandidates(candidates);
  const items = provider.match({
    source,
    candidates: candidateSignals,
    maxResults: COMMUNITY_INTELLIGENCE_MAX_RELATED,
    minScore: COMMUNITY_INTELLIGENCE_MIN_SCORE,
  });

  setCommunityIntelligenceCacheEntry(initiativeId, {
    expiresAt: Date.now() + COMMUNITY_INTELLIGENCE_CACHE_TTL_MS,
    items,
    providerId: provider.providerId,
    algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
  });

  return {
    sourceInitiativeId: initiativeId,
    items,
    emptyMessage: COMMUNITY_INTELLIGENCE_EMPTY_RELATED,
    audience: "public",
    providerId: provider.providerId,
    generatedAt,
    algorithmVersion: COMMUNITY_SIMILARITY_ALGORITHM_VERSION,
  };
}

export async function checkDraftSimilarity(
  draft: CommunitySimilarityCheckRequest,
): Promise<CommunitySimilarityCheckResponse> {
  const provider = resolveCommunitySimilarityProvider();
  const generatedAt = new Date().toISOString();
  const activityArea =
    draft.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER && draft.activityAreaOther
      ? draft.activityAreaOther
      : (draft.activityArea ?? "General");

  const pseudoSource: Pick<Initiative, "initiativeId" | "metadata"> = {
    initiativeId: draft.excludeInitiativeId ?? "draft-check",
    metadata: {
      category: activityArea,
      tags: [...(draft.tags ?? [])],
      region: "",
      language: "en",
      communitySlug: draft.communitySlug ?? "",
      activityArea: draft.activityArea ?? "Other",
      activityAreaOther: draft.activityAreaOther,
      countrySlug: draft.countrySlug,
      regionSlug: draft.regionSlug,
      participationScope: draft.participationScope as Initiative["metadata"]["participationScope"],
    },
  };

  const candidates = selectCandidateInitiatives(pseudoSource).filter(
    (initiative) => initiative.initiativeId !== draft.excludeInitiativeId,
  );
  const candidateSignals = await buildSignalsForCandidates(candidates);
  const items = provider.matchDraft(draft, candidateSignals, {
    maxResults: COMMUNITY_INTELLIGENCE_MAX_RELATED,
    minScore: COMMUNITY_INTELLIGENCE_MIN_SCORE,
  });
  const hasStrongOverlap = items.some(
    (item) =>
      item.relationshipType === "possible_duplicate" ||
      item.score >= COMMUNITY_INTELLIGENCE_STRONG_OVERLAP_SCORE,
  );

  return {
    items,
    hasStrongOverlap,
    emptyMessage: COMMUNITY_INTELLIGENCE_EMPTY_OVERLAP,
    providerId: provider.providerId,
    generatedAt,
    blocksCreation: false,
    autoMerges: false,
  };
}

function publicSkillsForProfile(
  profile: MemberProfile | undefined,
  viewerIsAuthenticated: boolean,
): string[] {
  if (!profile) {
    return [];
  }

  const visible = isMemberProfileFieldVisible(profile.skillsVisibility ?? "members_only", {
    viewerIsAuthenticated,
    viewerIsOwner: false,
  });

  if (!visible) {
    return [];
  }

  // Never use skills when the whole profile is private / not projectable.
  const publicProfile = toPublicMemberProfile(profile, {
    viewerIsAuthenticated,
    viewerIsOwner: false,
  });

  return publicProfile?.skills ?? [];
}

function locationAllowed(profile: MemberProfile | undefined): boolean {
  return Boolean(profile?.showLocation);
}

/**
 * Participant relevance uses only public Active Ally relationships and
 * privacy-respecting public profile fields. Never reads Direct Messages.
 */
export async function findRelevantParticipantsForInitiative(
  initiativeId: string,
  options: { readonly viewerIsAuthenticated: boolean } = { viewerIsAuthenticated: true },
): Promise<readonly CommunityParticipantRelevanceProjection[]> {
  if (!options.viewerIsAuthenticated) {
    return [];
  }

  const related = await findRelatedInitiativesForInitiative(initiativeId);
  const relatedIds = related.items.slice(0, 3).map((item) => item.initiativeId);
  const source = getInitiativeById(initiativeId);
  if (!source) {
    return [];
  }

  const initiativeIds = [initiativeId, ...relatedIds];
  const allyLists = await Promise.all(
    initiativeIds.map((id) => listActiveAlliesByInitiative(id)),
  );

  const allyCounts = new Map<string, { count: number; initiativeIds: Set<string> }>();
  for (let index = 0; index < initiativeIds.length; index += 1) {
    const id = initiativeIds[index]!;
    for (const ally of allyLists[index] ?? []) {
      if (ally.participantId === source.stewardId) {
        continue;
      }
      const entry = allyCounts.get(ally.participantId) ?? {
        count: 0,
        initiativeIds: new Set<string>(),
      };
      entry.count += 1;
      entry.initiativeIds.add(id);
      allyCounts.set(ally.participantId, entry);
    }
  }

  const rankedParticipantIds = [...allyCounts.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, COMMUNITY_INTELLIGENCE_MAX_PARTICIPANTS * 2)
    .map(([participantId]) => participantId);

  if (rankedParticipantIds.length === 0) {
    return [];
  }

  const authors = await resolvePublicAuthorsForParticipantIds(rankedParticipantIds);
  const authUsers = await findAuthUsersByMemberIds(rankedParticipantIds);
  const profiles = await findMemberProfilesByUserIds(
    [...authUsers.values()].map((user) => user.userId),
  );

  const sourceTokens = tokenizeCommunityText(
    `${source.title} ${source.description} ${resolveActivityArea(source)}`,
  );
  const results: CommunityParticipantRelevanceProjection[] = [];

  for (const participantId of rankedParticipantIds) {
    if (results.length >= COMMUNITY_INTELLIGENCE_MAX_PARTICIPANTS) {
      break;
    }

    const authUser = authUsers.get(participantId);
    const profile = authUser ? profiles.get(authUser.userId) : undefined;
    const author = authors.get(participantId);
    const allyMeta = allyCounts.get(participantId);
    if (!author || !allyMeta) {
      continue;
    }

    const reasons: Array<CommunityParticipantRelevanceProjection["reasons"][number]> = [];
    const sharedTopics: string[] = [];

    if (allyMeta.count > 0) {
      reasons.push({
        code: "active_ally_related",
        message: `Active Ally in ${allyMeta.count} related Initiative${allyMeta.count === 1 ? "" : "s"}`,
      });
    }

    const publicSkills = publicSkillsForProfile(profile, options.viewerIsAuthenticated);
    for (const skill of publicSkills) {
      const skillTokens = tokenizeCommunityText(skill);
      const overlap = [...skillTokens].some((token) => sourceTokens.has(token));
      if (overlap) {
        sharedTopics.push(skill);
        reasons.push({
          code: "public_skill_match",
          message: `Publicly lists a relevant skill: ${skill}`,
        });
        break;
      }
    }

    if (
      profile?.showParticipationArea &&
      isMemberProfileFieldVisible(profile.participationVisibility ?? "members_only", {
        viewerIsAuthenticated: options.viewerIsAuthenticated,
        viewerIsOwner: false,
      }) &&
      profile.participationAreaId
    ) {
      reasons.push({
        code: "public_participation_area",
        message: "Public Participation Area is available for collaboration context",
      });
    }

    // Explicitly never use hidden location.
    void locationAllowed(profile);

    if (reasons.length === 0) {
      continue;
    }

    results.push({
      participantId,
      displayName: author.displayName,
      profileUrl: author.profileUrl,
      avatarUrl: author.avatarUrl,
      reasons,
      sharedTopics,
      publicUrl: author.profileUrl,
    });
  }

  return results;
}

export async function buildCollaborationOpportunitiesForInitiative(
  initiativeId: string,
): Promise<readonly CommunityCollaborationOpportunityProjection[]> {
  const related = await findRelatedInitiativesForInitiative(initiativeId);
  const participants = await findRelevantParticipantsForInitiative(initiativeId, {
    viewerIsAuthenticated: true,
  });
  const opportunities: CommunityCollaborationOpportunityProjection[] = [];

  for (const item of related.items) {
    const kind =
      item.relationshipType === "possible_duplicate"
        ? "possible_duplicate"
        : item.relationshipType === "complementary"
          ? "complementary_initiative"
          : "related_initiative";

    opportunities.push({
      opportunityId: `${kind}:${item.initiativeId}`,
      kind,
      title: item.title,
      summary: item.reasons[0]?.message ?? "Related civic work",
      reasons: item.reasons,
      href: item.publicUrl,
      relationshipType: item.relationshipType,
      initiativeId: item.initiativeId,
    });
  }

  for (const participant of participants.slice(0, 2)) {
    opportunities.push({
      opportunityId: `relevant_participant:${participant.participantId}`,
      kind: "relevant_participant",
      title: participant.displayName,
      summary: participant.reasons[0]?.message ?? "May be relevant for collaboration",
      reasons: participant.reasons,
      href: participant.profileUrl ?? "/workspace",
      participantId: participant.participantId,
    });
  }

  return opportunities.slice(0, COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS);
}

export async function buildWorkspaceCommunityOpportunities(input: {
  readonly participantId: string;
  readonly memberId: string;
}): Promise<CommunityWorkspaceOpportunitiesResponse> {
  const generatedAt = new Date().toISOString();
  const myInitiatives = listInitiatives().filter(
    (initiative) =>
      initiative.stewardId === input.participantId &&
      isInitiativeEligibleForPublicProjection(initiative),
  );

  const opportunities: CommunityCollaborationOpportunityProjection[] = [];
  const seen = new Set<string>();

  for (const initiative of myInitiatives.slice(0, 5)) {
    const related = await findRelatedInitiativesForInitiative(initiative.initiativeId);
    for (const item of related.items) {
      if (seen.has(item.initiativeId)) {
        continue;
      }
      seen.add(item.initiativeId);

      const kind =
        item.relationshipType === "possible_duplicate"
          ? "possible_duplicate"
          : item.relationshipType === "complementary"
            ? "complementary_initiative"
            : "related_initiative";

      opportunities.push({
        opportunityId: `${kind}:${item.initiativeId}`,
        kind,
        title: item.title,
        summary: `Related to your Initiative “${initiative.title}”: ${item.reasons[0]?.message ?? "shared civic themes"}`,
        reasons: [
          {
            code: "anchored_to_owned_initiative",
            message: `You are seeing this because it relates to your Initiative “${initiative.title}”`,
          },
          ...item.reasons,
        ],
        href: item.publicUrl,
        relationshipType: item.relationshipType,
        initiativeId: item.initiativeId,
      });

      if (opportunities.length >= COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS) {
        break;
      }
    }

    if (opportunities.length >= COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS) {
      break;
    }
  }

  if (opportunities.length < COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS) {
    const priorityMatches = await findPriorityMatchingInitiatives(input.memberId);
    for (const match of priorityMatches) {
      if (match.strength !== "strong" || seen.has(match.initiativeId)) {
        continue;
      }
      seen.add(match.initiativeId);
      opportunities.push({
        opportunityId: `priority_match:${match.initiativeId}`,
        kind: "priority_match",
        title: match.title,
        summary: match.reasons[0]?.message ?? "Matches your selected priorities",
        reasons: match.reasons,
        href: match.publicUrl,
        initiativeId: match.initiativeId,
      });
      if (opportunities.length >= COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS) {
        break;
      }
    }
  }

  return {
    items: opportunities.slice(0, COMMUNITY_INTELLIGENCE_MAX_WORKSPACE_ITEMS),
    emptyMessage: COMMUNITY_INTELLIGENCE_EMPTY_COLLABORATION,
    generatedAt,
  };
}

export async function findPriorityMatchingInitiatives(memberId: string) {
  const preferences = getPreferencesByMemberId(memberId);
  if (!preferences) {
    return [];
  }

  return scorePriorityMatches(
    preferences,
    listInitiatives().filter(isInitiativeEligibleForPublicProjection),
  );
}

export async function buildAssistantCommunityIntelligenceContext(input: {
  readonly initiativeId: string | null;
  readonly participantId?: string | null;
  readonly includePersonalized: boolean;
}): Promise<CommunityIntelligenceAssistantContext> {
  const provider = resolveCommunitySimilarityProvider();
  let relatedInitiatives: readonly CommunityInitiativeRelationshipProjection[] = [];
  let collaborationOpportunities: readonly CommunityCollaborationOpportunityProjection[] = [];

  if (input.initiativeId) {
    const related = await findRelatedInitiativesForInitiative(input.initiativeId);
    relatedInitiatives = related.items;
    if (input.includePersonalized) {
      collaborationOpportunities = await buildCollaborationOpportunitiesForInitiative(
        input.initiativeId,
      );
    }
  } else if (input.includePersonalized && input.participantId) {
    const workspace = await buildWorkspaceCommunityOpportunities({
      participantId: input.participantId,
      memberId: input.participantId,
    });
    collaborationOpportunities = workspace.items;
  }

  return {
    providerId: provider.providerId,
    sourceInitiativeId: input.initiativeId,
    relatedInitiatives,
    collaborationOpportunities,
    explanationRule: COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
  };
}

