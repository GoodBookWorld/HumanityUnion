import type {
  DecisionSession,
  DecisionSessionEligibility,
  DecisionSessionMetrics,
  PublicDecisionSessionListItem,
  PublicDecisionSessionProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface CreateDecisionSessionDraftInput {
  initiativeId: string;
  title: string;
  purpose: string;
  decisionQuestion: string;
  opensAt: string;
  closesAt: string;
}

export interface SaveDecisionSessionDraftInput {
  title?: string;
  purpose?: string;
  decisionQuestion?: string;
  opensAt?: string;
  closesAt?: string;
}

export interface PublicDecisionSessionsResponse {
  sessions: PublicDecisionSessionListItem[];
  metrics: DecisionSessionMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listMyDecisionSessionsForInitiative(
  initiativeId: string,
): Promise<DecisionSession[]> {
  return apiRequest<DecisionSession[]>(
    `/api/v1/decision-sessions/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getDecisionSessionEligibility(
  initiativeId: string,
): Promise<DecisionSessionEligibility> {
  return apiRequest<DecisionSessionEligibility>(
    `/api/v1/decision-sessions/initiative/${encodeURIComponent(initiativeId)}/eligibility`,
  );
}

export async function createDecisionSessionDraft(
  input: CreateDecisionSessionDraftInput,
): Promise<DecisionSession> {
  return apiRequest<DecisionSession>("/api/v1/decision-sessions/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function saveDecisionSessionDraft(
  sessionId: string,
  input: SaveDecisionSessionDraftInput,
): Promise<DecisionSession> {
  return apiRequest<DecisionSession>(
    `/api/v1/decision-sessions/${encodeURIComponent(sessionId)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function publishDecisionSession(sessionId: string): Promise<DecisionSession> {
  return apiRequest<DecisionSession>(
    `/api/v1/decision-sessions/${encodeURIComponent(sessionId)}/publish`,
    {
      method: "POST",
    },
  );
}

export async function closeDecisionSession(sessionId: string): Promise<DecisionSession> {
  return apiRequest<DecisionSession>(
    `/api/v1/decision-sessions/${encodeURIComponent(sessionId)}/close`,
    {
      method: "POST",
    },
  );
}

export async function archiveDecisionSession(sessionId: string): Promise<DecisionSession> {
  return apiRequest<DecisionSession>(
    `/api/v1/decision-sessions/${encodeURIComponent(sessionId)}/archive`,
    {
      method: "POST",
    },
  );
}

export async function listPublicDecisionSessionsForInitiative(
  initiativeId: string,
): Promise<PublicDecisionSessionsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/decision-sessions`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    success: boolean;
    data: PublicDecisionSessionListItem[];
    meta: { metrics?: DecisionSessionMetrics };
    message: string;
  };

  if (!body.success) {
    throw new Error(body.message || "API request failed");
  }

  return {
    sessions: body.data,
    metrics: body.meta.metrics ?? {
      decisionSessionCount: 0,
      averagePreparationTimeDays: null,
      averageRevisionCountBeforeDecision: 0,
      averageAnalysisCountBeforeDecision: 0,
      averageProposalCountBeforeDecision: 0,
    },
  };
}

export async function getPublicDecisionSession(
  sessionId: string,
): Promise<PublicDecisionSessionProjection> {
  return apiRequest<PublicDecisionSessionProjection>(
    `/api/v1/public/decision-sessions/${encodeURIComponent(sessionId)}`,
  );
}
