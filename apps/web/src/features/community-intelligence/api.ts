import type {
  CommunityRelatedInitiativesResponse,
  CommunitySimilarityCheckRequest,
  CommunitySimilarityCheckResponse,
  CommunityWorkspaceOpportunitiesResponse,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchRelatedInitiatives(
  initiativeId: string,
): Promise<CommunityRelatedInitiativesResponse> {
  return apiRequest<CommunityRelatedInitiativesResponse>(
    `/api/v1/public/community-intelligence/initiatives/${encodeURIComponent(initiativeId)}/related`,
  );
}

export async function checkInitiativeSimilarity(
  input: CommunitySimilarityCheckRequest,
): Promise<CommunitySimilarityCheckResponse> {
  return apiRequest<CommunitySimilarityCheckResponse>(
    "/api/v1/community-intelligence/similarity-check",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function fetchWorkspaceCommunityOpportunities(): Promise<CommunityWorkspaceOpportunitiesResponse> {
  return apiRequest<CommunityWorkspaceOpportunitiesResponse>(
    "/api/v1/community-intelligence/workspace-opportunities",
  );
}
