import type {
  CivicEntityType,
  CivicSearchMetadata,
  CivicSearchQuery,
  CivicSearchResponse,
  CivicSearchResult,
} from "@hu/types";

export type { CivicSearchQuery, CivicSearchResponse, CivicSearchResult };

export interface GlobalSearchIndexEntry extends CivicSearchMetadata {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedCountry: string;
  normalizedRegion: string;
  normalizedCommunity: string;
  normalizedActivityArea: string;
  normalizedStatus: string;
  normalizedEntityType: string;
  normalizedCountryLabel: string;
  normalizedRegionLabel: string;
  normalizedCountryCode: string;
  normalizedRegionCode: string;
}

export interface GlobalSearchMatchInput {
  query: CivicSearchQuery;
  entry: GlobalSearchIndexEntry;
}

export interface GlobalSearchRankedMatch {
  entry: GlobalSearchIndexEntry;
  score: number;
  matchedFields: string[];
  explanation: string;
}

export const GLOBAL_SEARCH_DEFAULT_LIMIT = 20;
export const GLOBAL_SEARCH_MAX_LIMIT = 100;

export const GLOBAL_SEARCH_ENTITY_TYPE_LABELS: Record<CivicEntityType, string> = {
  initiative: "Initiative",
  analysis: "Collaborative Analysis",
  improvement_proposal: "Improvement Proposal",
  initiative_revision: "Initiative Revision",
  petition: "Petition",
  decision_session: "Decision Session",
  collective_decision: "Collective Decision",
  civic_action_package: "Civic Action Package",
  official_response: "Official Response",
  civic_accountability: "Civic Accountability",
  implementation_commitment: "Implementation Commitment",
  implementation_tracking: "Implementation Tracking",
  public_impact: "Public Impact",
  civic_archive: "Public Civic Archive",
  knowledge_article: "Knowledge Article",
  knowledge_media: "Knowledge Media",
  civic_nomination: "Civic Nomination",
  member_badge_contribution: "Member Badge Contribution",
  // Profile UX Pack 03 — Direct Collaboration conversations are private
  // and must never appear in global (public) search results; this label
  // exists only to satisfy the exhaustive `CivicEntityType` map.
  direct_conversation: "Direct Collaboration Conversation",
  blog_post: "Blog Post",
  // Author Access Pack 04 — applications are Workspace-private, never indexed.
  blog_author_application: "Blog Author Application",
};

export const PRIVATE_SEARCH_RESPONSE_KEYS = [
  "participantId",
  "authorId",
  "stewardId",
  "memberId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "voteId",
  "voteHistory",
  "rawSource",
  "messageHeaders",
  "providerMetadata",
  "jwt",
  "sessionId",
  "userId",
] as const;
