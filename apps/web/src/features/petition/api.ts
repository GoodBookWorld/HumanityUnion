import type { ParticipationMode, Petition, PublicPetitionProjection } from "@hu/types";

import { apiRequest, apiRequestOptional } from "../../lib/api-client";

export async function getPetitionById(petitionId: string): Promise<Petition> {
  return apiRequest<Petition>(`/api/v1/petitions/${encodeURIComponent(petitionId)}`);
}

export async function getPetitionByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<Petition | null> {
  return apiRequestOptional<Petition>(
    `/api/v1/petitions/by-collective-decision/${encodeURIComponent(collectiveDecisionId)}`,
  );
}

export async function getPetitionByInitiativeId(initiativeId: string): Promise<Petition | null> {
  return apiRequestOptional<Petition>(
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

/**
 * Initiative Lifecycle — Part F, Section 7/8 (Representative Signatures).
 * Unlike `signPetition` above (the pre-Lifecycle Petition workspace's
 * body-supplied `participantId` contract), this never sends its own id —
 * mirroring every Part D/E reaction endpoint
 * (`setInitiativeRevisionReaction`, etc.), the server resolves the real
 * signed-in Participant from the request itself.
 */
export async function signPetitionAsCurrentParticipant(petitionId: string): Promise<Petition> {
  return apiRequest<Petition>(`/api/v1/petitions/${encodeURIComponent(petitionId)}/signatures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ participationMode: "Public" }),
  });
}

/** Section 8 — "Withdraw Signature": one signature per Participant, reversible while the Petition stays open. */
export async function withdrawPetitionSignature(petitionId: string): Promise<Petition> {
  return apiRequest<Petition>(
    `/api/v1/petitions/${encodeURIComponent(petitionId)}/signatures/withdraw`,
    { method: "POST" },
  );
}

/**
 * Section 7 (Representative Signatures — Visitors). Anonymous civic-interest
 * signal, distinct from a `Signature` — tracked via a long-lived cookie the
 * server sets on first call (see `public-petition.routes.ts`).
 */
export async function recordPetitionVisitorSignal(
  petitionId: string,
): Promise<{ visitorSignals: number }> {
  return apiRequest<{ visitorSignals: number }>(
    `/api/v1/public/petitions/${encodeURIComponent(petitionId)}/visitor-signal`,
    { method: "POST" },
  );
}
