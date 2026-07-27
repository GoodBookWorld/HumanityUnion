import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationCommitmentMetrics,
  PublicInitiativeImplementationCommitmentListItem,
  PublicInitiativeImplementationCommitmentProjection,
} from "@hu/types";

import { apiRequest, fetchPublicInitiativeList } from "../../lib/api-client";

export interface PublicInitiativeImplementationCommitmentsResponse {
  commitments: PublicInitiativeImplementationCommitmentListItem[];
  metrics: InitiativeImplementationCommitmentMetrics;
}

const EMPTY_METRICS: InitiativeImplementationCommitmentMetrics = {
  commitmentCount: 0,
  publishedCommitments: 0,
  completedCommitments: 0,
  withdrawnCommitments: 0,
};

export async function listMyInitiativeImplementationCommitments(): Promise<
  InitiativeImplementationCommitment[]
> {
  return apiRequest<InitiativeImplementationCommitment[]>(
    "/api/v1/initiative-implementation-commitments/mine",
  );
}

export async function listPublicInitiativeImplementationCommitments(
  initiativeId: string,
): Promise<PublicInitiativeImplementationCommitmentsResponse> {
  const result = await fetchPublicInitiativeList<
    PublicInitiativeImplementationCommitmentListItem,
    InitiativeImplementationCommitmentMetrics
  >(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/implementation-commitments`,
    EMPTY_METRICS,
  );

  return {
    commitments: result.items,
    metrics: result.metrics,
  };
}

export async function listPublicInitiativeImplementationCommitmentsForDecision(
  decisionId: string,
): Promise<PublicInitiativeImplementationCommitmentListItem[]> {
  const result = await fetchPublicInitiativeList<
    PublicInitiativeImplementationCommitmentListItem,
    InitiativeImplementationCommitmentMetrics
  >(
    `/api/v1/public/initiative-collective-decisions/${encodeURIComponent(decisionId)}/implementation-commitments`,
    EMPTY_METRICS,
  );

  return result.items;
}

export async function getPublicInitiativeImplementationCommitment(
  commitmentId: string,
): Promise<PublicInitiativeImplementationCommitmentProjection | null> {
  try {
    return await apiRequest<PublicInitiativeImplementationCommitmentProjection>(
      `/api/v1/public/initiative-implementation-commitments/${encodeURIComponent(commitmentId)}`,
    );
  } catch {
    return null;
  }
}
