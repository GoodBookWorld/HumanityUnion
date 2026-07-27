import type {
  ImplementationTrackingUpdate,
  InitiativeImplementationTracking,
  InitiativeImplementationTrackingMetrics,
  PublicInitiativeImplementationTrackingListItem,
  PublicInitiativeImplementationTrackingProjection,
} from "@hu/types";

import { apiRequest, fetchPublicInitiativeList } from "../../lib/api-client";

export interface MyInitiativeImplementationTrackingsResponse {
  trackings: InitiativeImplementationTracking[];
  updates: ImplementationTrackingUpdate[];
}

export interface PublicInitiativeImplementationTrackingsResponse {
  trackings: PublicInitiativeImplementationTrackingListItem[];
  metrics: InitiativeImplementationTrackingMetrics;
}

const EMPTY_METRICS: InitiativeImplementationTrackingMetrics = {
  trackingCount: 0,
  activeTrackingCount: 0,
  completedTrackingCount: 0,
  averageUpdatesPerTracking: 0,
  averageCompletionTimeMs: null,
};

export async function listMyInitiativeImplementationTrackings(): Promise<MyInitiativeImplementationTrackingsResponse> {
  const payload = await apiRequest<InitiativeImplementationTracking[]>(
    "/api/v1/initiative-implementation-tracking/mine",
  );

  return {
    trackings: payload,
    updates: [],
  };
}

export async function listPublicInitiativeImplementationTrackings(
  initiativeId: string,
): Promise<PublicInitiativeImplementationTrackingsResponse> {
  const result = await fetchPublicInitiativeList<
    PublicInitiativeImplementationTrackingListItem,
    InitiativeImplementationTrackingMetrics
  >(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/implementation-tracking`,
    EMPTY_METRICS,
  );

  return {
    trackings: result.items,
    metrics: result.metrics,
  };
}

export async function listPublicInitiativeImplementationTrackingsForCommitment(
  commitmentId: string,
): Promise<PublicInitiativeImplementationTrackingListItem[]> {
  const result = await fetchPublicInitiativeList<
    PublicInitiativeImplementationTrackingListItem,
    InitiativeImplementationTrackingMetrics
  >(
    `/api/v1/public/initiative-implementation-commitments/${encodeURIComponent(commitmentId)}/implementation-tracking`,
    EMPTY_METRICS,
  );

  return result.items;
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
