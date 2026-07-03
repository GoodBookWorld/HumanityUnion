import type {
  Availability,
  CommitmentContributionType,
  ImplementationCommitment,
  ParticipantId,
  PublicImplementationCommitmentProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getImplementationCommitmentById(
  commitmentId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}`,
  );
}

export async function getImplementationCommitmentByPetitionId(
  petitionId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/by-petition/${encodeURIComponent(petitionId)}`,
  );
}

export async function getImplementationCommitmentByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/by-collective-decision/${encodeURIComponent(collectiveDecisionId)}`,
  );
}

export async function getImplementationCommitmentByInitiativeId(
  initiativeId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function submitImplementationCommitment(
  commitmentId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}/submit`,
    { method: "POST" },
  );
}

export async function activateImplementationCommitment(
  commitmentId: string,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}/activate`,
    { method: "POST" },
  );
}

export async function updateContributionProfile(
  commitmentId: string,
  participantId: ParticipantId,
  profile: {
    skillSummary?: string;
    regionalContext?: string;
    organizationalContext?: string;
  },
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}/contribution-profile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, ...profile }),
    },
  );
}

export interface AddContributionItemRequest {
  contributionItemId: string;
  participantId: ParticipantId;
  contributionType: CommitmentContributionType;
  contributionCapacity: string;
  availability: Availability;
  profile?: {
    skillSummary?: string;
    regionalContext?: string;
    organizationalContext?: string;
  };
}

export async function addContributionItem(
  commitmentId: string,
  input: AddContributionItemRequest,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}/contribution-items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function withdrawContributionItem(
  commitmentId: string,
  itemId: string,
  participantId?: ParticipantId,
): Promise<ImplementationCommitment> {
  return apiRequest<ImplementationCommitment>(
    `/api/v1/implementation-commitments/${encodeURIComponent(commitmentId)}/contribution-items/${encodeURIComponent(itemId)}/withdraw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(participantId ? { participantId } : {}),
    },
  );
}

export async function getPublicImplementationCommitment(
  commitmentId: string,
): Promise<PublicImplementationCommitmentProjection> {
  return apiRequest<PublicImplementationCommitmentProjection>(
    `/api/v1/public/implementation-commitments/${encodeURIComponent(commitmentId)}`,
  );
}
