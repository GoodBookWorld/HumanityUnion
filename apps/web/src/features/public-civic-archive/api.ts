import type {
  CivicArchiveLifecycleRecord,
  CivicArchiveLifecycleMetrics,
  CivicArchiveOutcomeStatus,
  PublicCivicArchiveListItem,
  PublicCivicArchiveProjection,
  PublicCivicArchiveRecord,
} from "@hu/types";

import { API_BASE_URL, apiRequest } from "../../lib/api-client";
import type { CivicArchiveAppliedFilters } from "./civic-archive-query";
import { buildCivicArchiveApiQuery } from "./civic-archive-query";

export interface PublicCivicArchiveIndexResponse {
  records: CivicArchiveLifecycleRecord[];
  total: number;
  metrics: CivicArchiveLifecycleMetrics;
}

function buildQueryString(query: Record<string, string | number>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function listPublicCivicArchiveIndex(
  query: CivicArchiveAppliedFilters = {},
  options?: { signal?: AbortSignal },
): Promise<PublicCivicArchiveIndexResponse> {
  const url = `${API_BASE_URL}/api/v1/public/civic-archive${buildQueryString(buildCivicArchiveApiQuery(query))}`;
  const response = await fetch(url, { cache: "no-store", signal: options?.signal });

  if (!response.ok) {
    throw new Error("Public civic archive index is not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: CivicArchiveLifecycleRecord[];
    meta: { metrics?: CivicArchiveLifecycleMetrics; total?: number };
  };

  if (!payload.success) {
    throw new Error("Public civic archive index is not available.");
  }

  const metrics = payload.meta.metrics ?? {
    archivedInitiativeCount: payload.data.length,
    archiveRecordCount: payload.data.length,
    countriesRepresented: 0,
    regionsRepresented: 0,
    communitiesRepresented: 0,
    activityAreasRepresented: 0,
    verifiedImpactCount: 0,
  };

  return {
    records: payload.data,
    total: payload.meta.total ?? payload.data.length,
    metrics,
  };
}

export async function getCivicArchiveLifecycleRecord(
  initiativeId: string,
): Promise<CivicArchiveLifecycleRecord | null> {
  try {
    return await apiRequest<CivicArchiveLifecycleRecord>(
      `/api/v1/public/civic-archive/${encodeURIComponent(initiativeId)}`,
    );
  } catch {
    return null;
  }
}

/** @deprecated Use getCivicArchiveLifecycleRecord for lifecycle detail pages. */
export async function getPublicCivicArchive(
  archiveRecordId: string,
): Promise<PublicCivicArchiveProjection | null> {
  try {
    return await apiRequest<PublicCivicArchiveProjection>(
      `/api/v1/public/civic-archive/${encodeURIComponent(archiveRecordId)}`,
    );
  } catch {
    return null;
  }
}

export async function getPublicCivicArchiveForImpact(
  impactId: string,
): Promise<CivicArchiveLifecycleRecord | PublicCivicArchiveProjection | null> {
  try {
    return await apiRequest<CivicArchiveLifecycleRecord | PublicCivicArchiveProjection>(
      `/api/v1/public/public-impact/${encodeURIComponent(impactId)}/civic-archive`,
    );
  } catch {
    return null;
  }
}

export async function listMyPublicCivicArchiveRecords(): Promise<PublicCivicArchiveRecord[]> {
  return apiRequest<PublicCivicArchiveRecord[]>("/api/v1/public-civic-archive/mine");
}

export async function getLatestPublicCivicArchiveForInitiative(initiativeId: string): Promise<{
  records: PublicCivicArchiveListItem[];
  lifecycle: CivicArchiveLifecycleRecord | null;
  latestArchiveRecordId: string | null;
}> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/civic-archive`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Initiative civic archive records are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicArchiveListItem[];
    meta: { latestArchiveRecordId?: string | null; lifecycle?: CivicArchiveLifecycleRecord | null };
  };

  if (!payload.success) {
    throw new Error("Initiative civic archive records are not available.");
  }

  return {
    records: payload.data,
    lifecycle: payload.meta.lifecycle ?? null,
    latestArchiveRecordId: payload.meta.latestArchiveRecordId ?? null,
  };
}

export type { CivicArchiveOutcomeStatus };
