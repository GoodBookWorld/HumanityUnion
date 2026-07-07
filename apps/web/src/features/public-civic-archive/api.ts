import type {
  PublicCivicArchiveListItem,
  PublicCivicArchiveMetrics,
  PublicCivicArchiveProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicCivicArchiveIndexQuery {
  search?: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  implementationYear?: number;
}

export interface PublicCivicArchiveIndexResponse {
  records: PublicCivicArchiveListItem[];
  metrics: PublicCivicArchiveMetrics;
}

const API_BASE_URL = "http://localhost:4000";

function buildQueryString(query: PublicCivicArchiveIndexQuery): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.country) {
    params.set("country", query.country);
  }

  if (query.region) {
    params.set("region", query.region);
  }

  if (query.community) {
    params.set("community", query.community);
  }

  if (query.activityArea) {
    params.set("activityArea", query.activityArea);
  }

  if (query.implementationYear) {
    params.set("implementationYear", String(query.implementationYear));
  }

  const serialized = params.toString();

  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function listPublicCivicArchiveIndex(
  query: PublicCivicArchiveIndexQuery = {},
): Promise<PublicCivicArchiveIndexResponse> {
  const url = `${API_BASE_URL}/api/v1/public/civic-archive${buildQueryString(query)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Public civic archive index is not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicArchiveListItem[];
    meta: { metrics?: PublicCivicArchiveMetrics };
  };

  if (!payload.success) {
    throw new Error("Public civic archive index is not available.");
  }

  return {
    records: payload.data,
    metrics: payload.meta.metrics ?? {
      archiveRecordCount: payload.data.length,
      countriesRepresented: 0,
      regionsRepresented: 0,
      communitiesRepresented: 0,
      activityAreasRepresented: 0,
      verifiedImpactCount: 0,
    },
  };
}

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
): Promise<PublicCivicArchiveProjection | null> {
  try {
    return await apiRequest<PublicCivicArchiveProjection>(
      `/api/v1/public/public-impact/${encodeURIComponent(impactId)}/civic-archive`,
    );
  } catch {
    return null;
  }
}

export async function getLatestPublicCivicArchiveForInitiative(
  initiativeId: string,
): Promise<{ records: PublicCivicArchiveListItem[]; latestArchiveRecordId: string | null }> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/civic-archive`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Initiative civic archive records are not available.");
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicArchiveListItem[];
    meta: { latestArchiveRecordId?: string | null };
  };

  if (!payload.success) {
    throw new Error("Initiative civic archive records are not available.");
  }

  return {
    records: payload.data,
    latestArchiveRecordId: payload.meta.latestArchiveRecordId ?? null,
  };
}
