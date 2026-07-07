import type {
  CivicAccountability,
  CivicAccountabilityEvent,
  CivicAccountabilityEventType,
  CivicAccountabilityMetrics,
  PublicCivicAccountabilityListItem,
  PublicCivicAccountabilityProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const API_BASE_URL = "http://localhost:4000";

export interface CivicAccountabilityDetail {
  accountability: CivicAccountability;
  events: CivicAccountabilityEvent[];
}

export async function listMyCivicAccountabilities(): Promise<CivicAccountability[]> {
  return apiRequest<CivicAccountability[]>("/api/v1/civic-accountability/mine");
}

export async function getMyCivicAccountability(
  accountabilityId: string,
): Promise<CivicAccountabilityDetail> {
  return apiRequest<CivicAccountabilityDetail>(
    `/api/v1/civic-accountability/${encodeURIComponent(accountabilityId)}`,
  );
}

export async function addCivicAccountabilityEvent(
  accountabilityId: string,
  input: {
    eventType: CivicAccountabilityEventType;
    title: string;
    summary: string;
    evidenceReference?: string;
    occurredAt: string;
  },
): Promise<{ accountability: CivicAccountability; event: CivicAccountabilityEvent }> {
  return apiRequest<{ accountability: CivicAccountability; event: CivicAccountabilityEvent }>(
    `/api/v1/civic-accountability/${encodeURIComponent(accountabilityId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function closeCivicAccountability(
  accountabilityId: string,
): Promise<CivicAccountability> {
  return apiRequest<CivicAccountability>(
    `/api/v1/civic-accountability/${encodeURIComponent(accountabilityId)}/close`,
    { method: "POST" },
  );
}

export async function archiveCivicAccountability(
  accountabilityId: string,
): Promise<CivicAccountability> {
  return apiRequest<CivicAccountability>(
    `/api/v1/civic-accountability/${encodeURIComponent(accountabilityId)}/archive`,
    { method: "POST" },
  );
}

export async function getPublicCivicAccountability(
  accountabilityId: string,
): Promise<PublicCivicAccountabilityProjection | null> {
  const url = `${API_BASE_URL}/api/v1/public/civic-accountability/${encodeURIComponent(accountabilityId)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicAccountabilityProjection;
  };

  return payload.success ? payload.data : null;
}

export async function listPublicCivicAccountabilitiesForCap(
  capId: string,
): Promise<PublicCivicAccountabilityListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/civic-action-packages/${encodeURIComponent(capId)}/civic-accountability`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicAccountabilityListItem[];
  };

  return payload.success ? payload.data : [];
}

export async function listPublicCivicAccountabilitiesForInitiative(
  initiativeId: string,
): Promise<PublicCivicAccountabilityListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/civic-accountability`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicAccountabilityListItem[];
  };

  return payload.success ? payload.data : [];
}

export async function listPublicCivicAccountabilitiesForResponse(
  responseId: string,
): Promise<PublicCivicAccountabilityListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/official-responses/${encodeURIComponent(responseId)}/civic-accountability`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicCivicAccountabilityListItem[];
  };

  return payload.success ? payload.data : [];
}

export type { CivicAccountabilityMetrics };
