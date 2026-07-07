import type {
  OfficialResponse,
  OfficialResponseMetrics,
  OfficialResponseType,
  OfficialResponseVerificationState,
  PublicOfficialResponseListItem,
  PublicOfficialResponseProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const API_BASE_URL = "http://localhost:4000";

export async function listMyOfficialResponses(): Promise<OfficialResponse[]> {
  return apiRequest<OfficialResponse[]>("/api/v1/official-responses/mine");
}

export async function createOfficialResponseDraft(input: {
  capId: string;
  deliveryId: string;
  recipientId: string;
  organizationName: string;
  receivedAt: string;
  subject: string;
  summary: string;
  responseReference: string;
  responseType: OfficialResponseType;
}): Promise<OfficialResponse> {
  return apiRequest<OfficialResponse>("/api/v1/official-responses/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateOfficialResponseDraft(
  responseId: string,
  input: Partial<{
    organizationName: string;
    receivedAt: string;
    subject: string;
    summary: string;
    responseReference: string;
    responseType: OfficialResponseType;
  }>,
): Promise<OfficialResponse> {
  return apiRequest<OfficialResponse>(
    `/api/v1/official-responses/${encodeURIComponent(responseId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishOfficialResponse(responseId: string): Promise<OfficialResponse> {
  return apiRequest<OfficialResponse>(
    `/api/v1/official-responses/${encodeURIComponent(responseId)}/publish`,
    { method: "POST" },
  );
}

export async function verifyOfficialResponse(
  responseId: string,
  verificationState: Extract<OfficialResponseVerificationState, "verified" | "unable_to_verify">,
): Promise<OfficialResponse> {
  return apiRequest<OfficialResponse>(
    `/api/v1/official-responses/${encodeURIComponent(responseId)}/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationState }),
    },
  );
}

export async function archiveOfficialResponse(responseId: string): Promise<OfficialResponse> {
  return apiRequest<OfficialResponse>(
    `/api/v1/official-responses/${encodeURIComponent(responseId)}/archive`,
    { method: "POST" },
  );
}

export async function getPublicOfficialResponse(
  responseId: string,
): Promise<PublicOfficialResponseProjection | null> {
  const url = `${API_BASE_URL}/api/v1/public/official-responses/${encodeURIComponent(responseId)}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicOfficialResponseProjection;
  };

  return payload.success ? payload.data : null;
}

export async function listPublicOfficialResponsesForCap(
  capId: string,
): Promise<PublicOfficialResponseListItem[]> {
  const url = `${API_BASE_URL}/api/v1/public/civic-action-packages/${encodeURIComponent(capId)}/official-responses`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicOfficialResponseListItem[];
  };

  return payload.success ? payload.data : [];
}

export interface PublicOfficialResponsesResponse {
  responses: PublicOfficialResponseListItem[];
  metrics: OfficialResponseMetrics;
}

export async function listPublicOfficialResponsesForInitiative(
  initiativeId: string,
): Promise<PublicOfficialResponsesResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/official-responses`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return {
      responses: [],
      metrics: {
        responseCount: 0,
        verifiedResponseCount: 0,
        pendingResponseCount: 0,
        unableToVerifyCount: 0,
        responseTypes: {
          official_letter: 0,
          email: 0,
          public_statement: 0,
          meeting_minutes: 0,
          policy_update: 0,
          decision_notice: 0,
          media_response: 0,
          other: 0,
        },
        recipientCoverage: 0,
      },
    };
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: PublicOfficialResponseListItem[];
    meta: { metrics?: OfficialResponseMetrics };
  };

  return {
    responses: payload.success ? payload.data : [],
    metrics: payload.meta?.metrics ?? {
      responseCount: 0,
      verifiedResponseCount: 0,
      pendingResponseCount: 0,
      unableToVerifyCount: 0,
      responseTypes: {
        official_letter: 0,
        email: 0,
        public_statement: 0,
        meeting_minutes: 0,
        policy_update: 0,
        decision_notice: 0,
        media_response: 0,
        other: 0,
      },
      recipientCoverage: 0,
    },
  };
}
