import type {
  CollectiveDecision,
  ParticipantDecision,
  PublicCollectiveDecisionProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getCollectiveDecisionById(decisionId: string): Promise<CollectiveDecision> {
  return apiRequest<CollectiveDecision>(
    `/api/v1/collective-decisions/${encodeURIComponent(decisionId)}`,
  );
}

export async function getCollectiveDecisionByInitiativeId(
  initiativeId: string,
): Promise<CollectiveDecision> {
  return apiRequest<CollectiveDecision>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/decision`,
  );
}

export async function getPublicCollectiveDecision(
  decisionId: string,
): Promise<PublicCollectiveDecisionProjection> {
  return apiRequest<PublicCollectiveDecisionProjection>(
    `/api/v1/public/collective-decisions/${encodeURIComponent(decisionId)}`,
  );
}

export async function submitParticipantDecision(
  decisionId: string,
  participantDecision: ParticipantDecision,
): Promise<CollectiveDecision> {
  return apiRequest<CollectiveDecision>(
    `/api/v1/collective-decisions/${encodeURIComponent(decisionId)}/participant-decisions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(participantDecision),
    },
  );
}
