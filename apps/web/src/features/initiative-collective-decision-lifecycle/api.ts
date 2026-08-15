import type {
  InitiativeCollectiveDecision,
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeCollectiveDecisionLifecycleDraftContext,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeCollectiveDecisionWorkspace(
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionLifecycleDraftContext> {
  return apiRequest<InitiativeCollectiveDecisionLifecycleDraftContext>(
    `/api/v1/initiative-collective-decision-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeCollectiveDecisionDraft(
  initiativeId: string,
): Promise<InitiativeCollectiveDecisionLifecycleDraft> {
  return apiRequest<InitiativeCollectiveDecisionLifecycleDraft>(
    `/api/v1/initiative-collective-decision-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeCollectiveDecisionDraft(
  initiativeId: string,
  input: Partial<
    Pick<
      InitiativeCollectiveDecisionLifecycleDraft,
      | "title"
      | "decisionSummary"
      | "approvedActions"
      | "rejectedAlternatives"
      | "responsibleRoles"
      | "implementationPriorities"
      | "implementationTimeline"
      | "decisionRationale"
      | "decisionRisks"
      | "successCriteria"
      | "requiredResources"
      | "supportingReferences"
      | "participationScope"
      | "closesAt"
    >
  >,
): Promise<InitiativeCollectiveDecisionLifecycleDraft> {
  return apiRequest<InitiativeCollectiveDecisionLifecycleDraft>(
    `/api/v1/initiative-collective-decision-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeCollectiveDecisionStage(
  initiativeId: string,
): Promise<InitiativeCollectiveDecision> {
  return apiRequest<InitiativeCollectiveDecision>(
    `/api/v1/initiative-collective-decision-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}
