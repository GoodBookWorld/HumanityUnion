import type {
  InitiativeImplementationCommitmentMetrics,
  PublicInitiativeImplementationCommitmentListItem,
  PublicInitiativeImplementationCommitmentProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicInitiativeImplementationCommitmentsResponse {
  commitments: PublicInitiativeImplementationCommitmentListItem[];
  metrics: InitiativeImplementationCommitmentMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listPublicInitiativeImplementationCommitments(
  initiativeId: string,
): Promise<PublicInitiativeImplementationCommitmentsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/implementation-commitments`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public implementation commitments are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeImplementationCommitmentListItem[];
    meta: { metrics?: InitiativeImplementationCommitmentMetrics };
  };

  if (!payload.success) {
    throw new Error("Public implementation commitments are not available.");
  }

  return {
    commitments: payload.data,
    metrics: payload.meta.metrics ?? {
      commitmentCount: payload.data.length,
      publishedCommitments: 0,
      completedCommitments: 0,
      withdrawnCommitments: 0,
    },
  };
}

export async function listPublicInitiativeImplementationCommitmentsForDecision(
  decisionId: string,
): Promise<PublicInitiativeImplementationCommitmentListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/initiative-collective-decisions/${encodeURIComponent(decisionId)}/implementation-commitments`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public implementation commitments are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeImplementationCommitmentListItem[];
  };

  if (!payload.success) {
    throw new Error("Public implementation commitments are not available.");
  }

  return payload.data;
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
