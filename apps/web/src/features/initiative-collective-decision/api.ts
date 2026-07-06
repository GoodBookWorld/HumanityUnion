import type {
  InitiativeCollectiveDecisionMetrics,
  InitiativeDecisionVote,
  PublicInitiativeCollectiveDecisionListItem,
  PublicInitiativeCollectiveDecisionProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicInitiativeCollectiveDecisionsResponse {
  decisions: PublicInitiativeCollectiveDecisionListItem[];
  metrics: InitiativeCollectiveDecisionMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listPublicInitiativeCollectiveDecisions(
  initiativeId: string,
): Promise<PublicInitiativeCollectiveDecisionsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/collective-decisions`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public collective decisions are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeCollectiveDecisionListItem[];
    meta: { metrics?: InitiativeCollectiveDecisionMetrics };
  };

  if (!payload.success) {
    throw new Error("Public collective decisions are not available.");
  }

  return {
    decisions: payload.data,
    metrics: payload.meta.metrics ?? {
      decisionCount: payload.data.length,
      openedCount: 0,
      closedCount: 0,
      cancelledCount: 0,
    },
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
