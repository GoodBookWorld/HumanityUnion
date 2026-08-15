import type {
  CommunityInitiativeRelationshipProjection,
  CommunitySimilarityCheckRequest,
} from "@hu/types";

/**
 * Future semantic providers (embeddings / Gemini / local models) may implement
 * this seam. Pack 01 ships deterministic only — semantic ranking must stay
 * optional and may only re-rank candidates after public deterministic selection.
 */
export type CommunitySimilarityProviderId = "deterministic" | "semantic_future";

export interface CommunityInitiativeSignalDocument {
  readonly initiativeId: string;
  readonly title: string;
  readonly description: string;
  readonly activityArea: string;
  readonly tags: readonly string[];
  readonly category?: string;
  readonly countrySlug?: string;
  readonly regionSlug?: string;
  readonly communitySlug?: string;
  readonly participationScope?: string;
  /** Public Analysis free-text themes when available (never author-private snapshots). */
  readonly publicAnalysisThemes: readonly string[];
  readonly publicUrl: string;
}

export interface CommunitySimilarityMatchInput {
  readonly source: CommunityInitiativeSignalDocument;
  readonly candidates: readonly CommunityInitiativeSignalDocument[];
  readonly maxResults: number;
  readonly minScore: number;
}

export interface CommunitySimilarityProvider {
  readonly providerId: CommunitySimilarityProviderId;
  match(
    input: CommunitySimilarityMatchInput,
  ): readonly CommunityInitiativeRelationshipProjection[];
  matchDraft(
    draft: CommunitySimilarityCheckRequest,
    candidates: readonly CommunityInitiativeSignalDocument[],
    options: { readonly maxResults: number; readonly minScore: number },
  ): readonly CommunityInitiativeRelationshipProjection[];
}
