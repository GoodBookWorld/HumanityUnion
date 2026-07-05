import type { ParticipationMode, Petition, PublicPetitionProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getPetitionById(petitionId: string): Promise<Petition> {
  return apiRequest<Petition>(`/api/v1/petitions/${encodeURIComponent(petitionId)}`);
}

export async function getPetitionByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<Petition> {
  return apiRequest<Petition>(
    `/api/v1/petitions/by-collective-decision/${encodeURIComponent(collectiveDecisionId)}`,
  );
}

export async function getPetitionByInitiativeId(initiativeId: string): Promise<Petition> {
  return apiRequest<Petition>(
    `/api/v1/petitions/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getPublicPetition(petitionId: string): Promise<PublicPetitionProjection> {
  return apiRequest<PublicPetitionProjection>(
    `/api/v1/public/petitions/${encodeURIComponent(petitionId)}`,
  );
}

export async function signPetition(
  petitionId: string,
  participantId: string,
  participationMode: ParticipationMode = "Community",
): Promise<Petition> {
  return apiRequest<Petition>(`/api/v1/petitions/${encodeURIComponent(petitionId)}/signatures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      participantId,
      participationMode,
    }),
  });
}
