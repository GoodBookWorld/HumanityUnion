import type {
  DecisionSession,
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionDraftContext,
  InitiativeDecisionSessionRecommendation,
  InitiativeDecisionSessionRecommendationKind,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeDecisionSessionWorkspace(
  initiativeId: string,
): Promise<InitiativeDecisionSessionDraftContext> {
  return apiRequest<InitiativeDecisionSessionDraftContext>(
    `/api/v1/initiative-decision-sessions/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeDecisionSessionDraft(
  initiativeId: string,
): Promise<InitiativeDecisionSessionDraft> {
  return apiRequest<InitiativeDecisionSessionDraft>(
    `/api/v1/initiative-decision-sessions/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeDecisionSessionDraft(
  initiativeId: string,
  input: Partial<
    Pick<
      InitiativeDecisionSessionDraft,
      | "title"
      | "decisionQuestion"
      | "decisionContext"
      | "objectives"
      | "options"
      | "supportingArguments"
      | "risks"
      | "dependencies"
      | "requiredResources"
      | "suggestedTimeline"
      | "suggestedParticipants"
      | "suggestedResponsibleRoles"
      | "unresolvedQuestions"
      | "purpose"
      | "opensAt"
      | "closesAt"
    >
  >,
): Promise<InitiativeDecisionSessionDraft> {
  return apiRequest<InitiativeDecisionSessionDraft>(
    `/api/v1/initiative-decision-sessions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeDecisionSessionStage(
  initiativeId: string,
): Promise<DecisionSession> {
  return apiRequest<DecisionSession>(
    `/api/v1/initiative-decision-sessions/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export async function submitInitiativeDecisionSessionRecommendation(
  initiativeId: string,
  input: {
    kind: InitiativeDecisionSessionRecommendationKind;
    title: string;
    body: string;
  },
): Promise<InitiativeDecisionSessionRecommendation> {
  return apiRequest<InitiativeDecisionSessionRecommendation>(
    `/api/v1/initiative-decision-sessions/initiative/${encodeURIComponent(initiativeId)}/recommendations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
