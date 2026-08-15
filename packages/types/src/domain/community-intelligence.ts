/**
 * Community Intelligence Pack 01 — provider-independent discovery types.
 *
 * Similarity means topic/work relationship only. Results must remain
 * explainable. Classifications never claim semantic certainty beyond evidence.
 * `possible_duplicate` never means automatic merge or suppression.
 */

export type CommunityInitiativeRelationshipType =
  | "possible_duplicate"
  | "related"
  | "complementary";

export type CommunityIntelligenceAudience = "public" | "authenticated";

export interface CommunityIntelligenceReason {
  /** Stable machine code for tests / Assistant grounding. */
  readonly code: string;
  /** Participant-facing explanation (Why am I seeing this?). */
  readonly message: string;
}

export interface CommunityInitiativeRelationshipProjection {
  readonly initiativeId: string;
  readonly title: string;
  readonly relationshipType: CommunityInitiativeRelationshipType;
  /**
   * Internal relative strength for ordering only. Prefer reasons in UI.
   * Bounded 0–1; never presented as human worth.
   */
  readonly score: number;
  readonly reasons: readonly CommunityIntelligenceReason[];
  readonly sharedTopics: readonly string[];
  readonly sharedParticipationAreas: readonly string[];
  readonly sharedPriorities: readonly string[];
  readonly keyDifferences: readonly string[];
  readonly publicUrl: string;
}

export interface CommunityRelatedInitiativesResponse {
  readonly sourceInitiativeId: string | null;
  readonly items: readonly CommunityInitiativeRelationshipProjection[];
  readonly emptyMessage: string;
  readonly audience: CommunityIntelligenceAudience;
  readonly providerId: string;
  readonly generatedAt: string;
  /**
   * Pack 02 — internal algorithm version for diagnostics/cache coherence.
   * Not intended as ordinary Participant-facing UI.
   */
  readonly algorithmVersion: string;
}

export interface CommunitySimilarityCheckRequest {
  readonly title: string;
  readonly description: string;
  readonly activityArea?: string;
  readonly activityAreaOther?: string;
  readonly tags?: readonly string[];
  readonly countrySlug?: string;
  readonly regionSlug?: string;
  readonly communitySlug?: string;
  readonly participationScope?: string;
  /** Exclude an existing draft when re-checking before publish. */
  readonly excludeInitiativeId?: string;
}

export interface CommunitySimilarityCheckResponse {
  readonly items: readonly CommunityInitiativeRelationshipProjection[];
  readonly hasStrongOverlap: boolean;
  readonly emptyMessage: string;
  readonly providerId: string;
  readonly generatedAt: string;
  /** Explicit product guarantee — never auto-merge. */
  readonly blocksCreation: false;
  readonly autoMerges: false;
}

export interface CommunityParticipantRelevanceProjection {
  readonly participantId: string;
  readonly displayName: string;
  readonly profileUrl?: string;
  readonly avatarUrl?: string;
  readonly reasons: readonly CommunityIntelligenceReason[];
  readonly sharedTopics: readonly string[];
  readonly publicUrl?: string;
}

export interface CommunityCollaborationOpportunityProjection {
  readonly opportunityId: string;
  readonly kind:
    | "related_initiative"
    | "possible_duplicate"
    | "complementary_initiative"
    | "relevant_participant"
    | "priority_match";
  readonly title: string;
  readonly summary: string;
  readonly reasons: readonly CommunityIntelligenceReason[];
  readonly href: string;
  readonly relationshipType?: CommunityInitiativeRelationshipType;
  readonly initiativeId?: string;
  readonly participantId?: string;
}

export interface CommunityWorkspaceOpportunitiesResponse {
  readonly items: readonly CommunityCollaborationOpportunityProjection[];
  readonly emptyMessage: string;
  readonly generatedAt: string;
}

export interface CommunityPriorityMatchProjection {
  readonly initiativeId: string;
  readonly title: string;
  readonly publicUrl: string;
  readonly matchedPriorities: readonly string[];
  readonly reasons: readonly CommunityIntelligenceReason[];
  readonly strength: "strong" | "weak";
  readonly reminderEligible: boolean;
}

/** Structured Assistant grounding — never invent relationships beyond this. */
export interface CommunityIntelligenceAssistantContext {
  readonly providerId: string;
  readonly sourceInitiativeId: string | null;
  readonly relatedInitiatives: readonly CommunityInitiativeRelationshipProjection[];
  readonly collaborationOpportunities: readonly CommunityCollaborationOpportunityProjection[];
  readonly explanationRule: string;
}
