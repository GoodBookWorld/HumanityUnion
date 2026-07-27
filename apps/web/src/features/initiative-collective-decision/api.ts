import type {
  InitiativeCollectiveDecisionMetrics,
  InitiativeDecisionVote,
  PublicInitiativeCollectiveDecisionListItem,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

import { apiRequest, fetchPublicInitiativeList } from "../../lib/api-client";

export interface PublicInitiativeCollectiveDecisionsResponse {
  decisions: PublicInitiativeCollectiveDecisionListItem[];
  metrics: InitiativeCollectiveDecisionMetrics;
}

const EMPTY_METRICS: InitiativeCollectiveDecisionMetrics = {
  decisionCount: 0,
  openedCount: 0,
  closedCount: 0,
  cancelledCount: 0,
};

export async function listPublicInitiativeCollectiveDecisions(
  initiativeId: string,
): Promise<PublicInitiativeCollectiveDecisionsResponse> {
  const result = await fetchPublicInitiativeList<
    PublicInitiativeCollectiveDecisionListItem,
    InitiativeCollectiveDecisionMetrics
  >(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collective-decisions`,
    EMPTY_METRICS,
  );

  return {
    decisions: result.items,
    metrics: result.metrics,
  };
}

export async function getPublicInitiativeCollectiveDecision(
  decisionId: string,
): Promise<PublicInitiativeCollectiveDecisionProjection | null> {
  try {
    return await apiRequest<PublicInitiativeCollectiveDecisionProjection>(
      `/api/v1/public/initiative-collective-decisions/${encodeURIComponent(decisionId)}`,
    );
  } catch {
    return null;
  }
}

export async function getPublicInitiativeCollectiveDecisionOrThrow(
  decisionId: string,
): Promise<PublicInitiativeCollectiveDecisionProjection> {
  return apiRequest<PublicInitiativeCollectiveDecisionProjection>(
    `/api/v1/public/initiative-collective-decisions/${encodeURIComponent(decisionId)}`,
  );
}

export async function getMyInitiativeDecisionVote(
  decisionId: string,
): Promise<InitiativeDecisionVote | null> {
  return apiRequest<InitiativeDecisionVote | null>(
    `/api/v1/initiative-collective-decisions/${encodeURIComponent(decisionId)}/my-vote`,
  );
}
