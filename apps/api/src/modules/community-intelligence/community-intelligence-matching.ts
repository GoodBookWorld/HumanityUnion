import type {
  CommunityCollaborationOpportunityProjection,
  CommunityInitiativeRelationshipProjection,
  CommunityIntelligenceAssistantContext,
  CommunityPriorityMatchProjection,
  Initiative,
  MemberPreferences,
} from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OTHER } from "@hu/types";

import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";

function publicInitiativeUrl(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

import {
  COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
  COMMUNITY_INTELLIGENCE_EMPTY_RELATED,
  COMMUNITY_INTELLIGENCE_MAX_CANDIDATES,
  COMMUNITY_INTELLIGENCE_MAX_RELATED,
  COMMUNITY_INTELLIGENCE_PRIORITY_REMINDER_MIN_SIGNALS,
} from "./community-intelligence.constants.js";

export function resolveInitiativeActivityArea(initiative: Initiative): string {
  if (
    initiative.metadata.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER &&
    initiative.metadata.activityAreaOther
  ) {
    return initiative.metadata.activityAreaOther;
  }

  return initiative.metadata.activityArea;
}

/**
 * Candidate retrieval is bounded: prefer same activity area, then fill from
 * remaining public Initiatives up to MAX_CANDIDATES. Never loads private drafts.
 */
export function selectCandidateInitiatives(
  source: Pick<Initiative, "initiativeId" | "metadata">,
  all: readonly Initiative[],
): Initiative[] {
  const sourceArea = (
    source.metadata.activityArea === INITIATIVE_ACTIVITY_AREA_OTHER &&
    source.metadata.activityAreaOther
      ? source.metadata.activityAreaOther
      : source.metadata.activityArea
  )
    .trim()
    .toLowerCase();

  const eligible = all.filter(
    (initiative) =>
      initiative.initiativeId !== source.initiativeId &&
      isInitiativeEligibleForPublicProjection(initiative),
  );

  const sameArea: Initiative[] = [];
  const others: Initiative[] = [];

  for (const initiative of eligible) {
    const area = resolveInitiativeActivityArea(initiative).trim().toLowerCase();
    if (area && area === sourceArea) {
      sameArea.push(initiative);
    } else {
      others.push(initiative);
    }
  }

  sameArea.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  others.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return [...sameArea, ...others].slice(0, COMMUNITY_INTELLIGENCE_MAX_CANDIDATES);
}

export function scorePriorityMatches(
  preferences: MemberPreferences,
  initiatives: readonly Initiative[],
): CommunityPriorityMatchProjection[] {
  const participation = preferences.participationPreferences;
  const preferredAreas = participation.preferredActivityAreas.map((value) => value.toLowerCase());
  const topics = participation.interestedTopics.map((value) => value.toLowerCase());
  const interests = participation.initiativeParticipationInterests.map((value) =>
    value.toLowerCase(),
  );

  if (preferredAreas.length === 0 && topics.length === 0 && interests.length === 0) {
    return [];
  }

  const matches: CommunityPriorityMatchProjection[] = [];

  for (const initiative of initiatives) {
    const activityArea = resolveInitiativeActivityArea(initiative);
    const areaLower = activityArea.toLowerCase();
    const titleLower = initiative.title.toLowerCase();
    const descriptionLower = initiative.description.toLowerCase();
    const matchedPriorities: string[] = [];
    const reasons: Array<CommunityPriorityMatchProjection["reasons"][number]> = [];
    let signals = 0;

    if (preferredAreas.some((area) => area === areaLower)) {
      matchedPriorities.push(activityArea);
      reasons.push({
        code: "preferred_activity_area",
        message: `Matches your selected Participation Area “${activityArea}”`,
      });
      signals += 1;
    }

    for (const topic of topics) {
      if (
        areaLower.includes(topic) ||
        titleLower.includes(topic) ||
        descriptionLower.includes(topic)
      ) {
        matchedPriorities.push(topic);
        reasons.push({
          code: "interested_topic",
          message: `Shares your selected priority topic “${topic}”`,
        });
        signals += 1;
        break;
      }
    }

    for (const interest of interests) {
      if (titleLower.includes(interest) || descriptionLower.includes(interest)) {
        matchedPriorities.push(interest);
        reasons.push({
          code: "participation_interest",
          message: `Aligns with your initiative interest “${interest}”`,
        });
        signals += 1;
        break;
      }
    }

    if (signals === 0 || reasons.length === 0) {
      continue;
    }

    const strength =
      signals >= COMMUNITY_INTELLIGENCE_PRIORITY_REMINDER_MIN_SIGNALS ? "strong" : "weak";

    matches.push({
      initiativeId: initiative.initiativeId,
      title: initiative.title,
      publicUrl: publicInitiativeUrl(initiative.initiativeId),
      matchedPriorities,
      reasons,
      strength,
      reminderEligible: strength === "strong",
    });
  }

  return matches
    .sort((left, right) => {
      if (left.strength !== right.strength) {
        return left.strength === "strong" ? -1 : 1;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, COMMUNITY_INTELLIGENCE_MAX_RELATED);
}

export function formatCommunityIntelligenceForAssistantPrompt(
  context: CommunityIntelligenceAssistantContext,
): string {
  const lines = [
    "Community Intelligence (structured — do not invent beyond this):",
    context.explanationRule,
    `providerId: ${context.providerId}`,
    `sourceInitiativeId: ${context.sourceInitiativeId ?? "none"}`,
  ];

  if (context.relatedInitiatives.length === 0 && context.collaborationOpportunities.length === 0) {
    lines.push(COMMUNITY_INTELLIGENCE_EMPTY_RELATED);
    return lines.join("\n");
  }

  for (const item of context.relatedInitiatives) {
    lines.push(
      `- ${item.relationshipType}: “${item.title}” (${item.initiativeId}) reasons: ${item.reasons.map((reason) => reason.message).join("; ")}${item.keyDifferences.length > 0 ? ` differences: ${item.keyDifferences.join("; ")}` : ""}`,
    );
  }

  for (const opportunity of context.collaborationOpportunities) {
    if (opportunity.kind === "relevant_participant" || opportunity.kind === "priority_match") {
      lines.push(
        `- opportunity/${opportunity.kind}: “${opportunity.title}” reasons: ${opportunity.reasons.map((reason) => reason.message).join("; ")}`,
      );
    }
  }

  return lines.join("\n");
}

export function instructionsRequestCommunityIntelligence(instructions: string): boolean {
  return /\b(similar|related|duplicate|duplicat|overlap|collaborat|complementary|already exist|same initiative|other initiative|why am i seeing|stop creating|have to stop|must i stop|block(s|ed|ing)? creation|prevent(s|ed|ing)? (me from )?creat)\b/i.test(
    instructions,
  );
}

export function buildEmptyAssistantCommunityContext(
  providerId: string,
  sourceInitiativeId: string | null,
  relatedInitiatives: readonly CommunityInitiativeRelationshipProjection[] = [],
  collaborationOpportunities: readonly CommunityCollaborationOpportunityProjection[] = [],
): CommunityIntelligenceAssistantContext {
  return {
    providerId,
    sourceInitiativeId,
    relatedInitiatives,
    collaborationOpportunities,
    explanationRule: COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
  };
}
