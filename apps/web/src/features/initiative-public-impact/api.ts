import type {
  InitiativePublicImpact,
  InitiativePublicImpactMetrics,
  PublicInitiativePublicImpactListItem,
  PublicInitiativePublicImpactProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicInitiativePublicImpactsResponse {
  impacts: PublicInitiativePublicImpactListItem[];
  metrics: InitiativePublicImpactMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listMyInitiativePublicImpacts(): Promise<InitiativePublicImpact[]> {
  return apiRequest<InitiativePublicImpact[]>("/api/v1/initiative-public-impact/mine");
}

export async function listPublicInitiativePublicImpacts(
  initiativeId: string,
): Promise<PublicInitiativePublicImpactsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/public-impact`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public impact records are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativePublicImpactListItem[];
    meta: { metrics?: InitiativePublicImpactMetrics };
  };

  if (!payload.success) {
    throw new Error("Public impact records are not available.");
  }

  return {
    impacts: payload.data,
    metrics: payload.meta.metrics ?? {
      impactCount: payload.data.length,
      publishedImpactCount: 0,
      verifiedImpactCount: 0,
      averageEvidencePerImpact: 0,
    },
  };
}

export async function listPublicInitiativePublicImpactsForTracking(
  trackingId: string,
): Promise<PublicInitiativePublicImpactListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/initiative-implementation-tracking/${encodeURIComponent(trackingId)}/public-impact`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public impact records are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativePublicImpactListItem[];
  };

  if (!payload.success) {
    throw new Error("Public impact records are not available.");
  }

  return payload.data;
}

export async function getPublicInitiativePublicImpact(
  impactId: string,
): Promise<PublicInitiativePublicImpactProjection | null> {
  try {
    return await apiRequest<PublicInitiativePublicImpactProjection>(
      `/api/v1/public/public-impact/${encodeURIComponent(impactId)}`,
    );
  } catch {
    return null;
  }
}
