import type {
  InitiativeImplementationTrackingMetrics,
  PublicInitiativeImplementationTrackingListItem,
  PublicInitiativeImplementationTrackingProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicInitiativeImplementationTrackingsResponse {
  trackings: PublicInitiativeImplementationTrackingListItem[];
  metrics: InitiativeImplementationTrackingMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listPublicInitiativeImplementationTrackings(
  initiativeId: string,
): Promise<PublicInitiativeImplementationTrackingsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/implementation-tracking`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public implementation tracking is not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeImplementationTrackingListItem[];
    meta: { metrics?: InitiativeImplementationTrackingMetrics };
  };

  if (!payload.success) {
    throw new Error("Public implementation tracking is not available.");
  }

  return {
    trackings: payload.data,
    metrics: payload.meta.metrics ?? {
      trackingCount: payload.data.length,
      activeTrackingCount: 0,
      completedTrackingCount: 0,
      averageUpdatesPerTracking: 0,
      averageCompletionTimeMs: null,
    },
  };
}

export async function listPublicInitiativeImplementationTrackingsForCommitment(
  commitmentId: string,
): Promise<PublicInitiativeImplementationTrackingListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/initiative-implementation-commitments/${encodeURIComponent(commitmentId)}/implementation-tracking`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public implementation tracking is not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeImplementationTrackingListItem[];
  };

  if (!payload.success) {
    throw new Error("Public implementation tracking is not available.");
  }

  return payload.data;
}

export async function getPublicInitiativeImplementationTracking(
  trackingId: string,
): Promise<PublicInitiativeImplementationTrackingProjection | null> {
  try {
    return await apiRequest<PublicInitiativeImplementationTrackingProjection>(
      `/api/v1/public/initiative-implementation-tracking/${encodeURIComponent(trackingId)}`,
    );
  } catch {
    return null;
  }
}
