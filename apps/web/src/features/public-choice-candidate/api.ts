import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVote,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListPublicChoiceCandidatesResponse {
  candidates: PublicChoiceCandidatePublicProjection[];
}

export interface CreatePublicChoiceCandidateInput {
  name: string;
  photoUrl?: string;
  campaignPageUrl?: string;
}

export interface UpdatePublicChoiceCandidateInput {
  name?: string;
  photoUrl?: string | null;
  campaignPageUrl?: string | null;
}

/**
 * Pack 02A / Fix 06 — Candidate CRUD.
 * List uses the public initiatives path so Visitors and Participants share one roster.
 * credentials:include still carries visitor/auth cookies for writes and votes.
 */
export async function listPublicChoiceCandidates(
  initiativeId: string,
): Promise<PublicChoiceCandidatePublicProjection[]> {
  const result = await apiRequest<ListPublicChoiceCandidatesResponse>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/candidates`,
  );
  return result.candidates;
}

export async function createPublicChoiceCandidate(
  initiativeId: string,
  input: CreatePublicChoiceCandidateInput,
): Promise<PublicChoiceCandidatePublicProjection> {
  return apiRequest<PublicChoiceCandidatePublicProjection>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/candidates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function updatePublicChoiceCandidate(
  initiativeId: string,
  candidateId: string,
  input: UpdatePublicChoiceCandidateInput,
): Promise<PublicChoiceCandidatePublicProjection> {
  return apiRequest<PublicChoiceCandidatePublicProjection>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/candidates/${encodeURIComponent(candidateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function deletePublicChoiceCandidate(
  initiativeId: string,
  candidateId: string,
): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/candidates/${encodeURIComponent(candidateId)}`,
    { method: "DELETE" },
  );
}

/**
 * Pack 02A — cast Decision Vote with optional candidateId.
 * credentials:include carries visitor cookie `hu_initiative_visitor` when unsigned-in.
 */
export async function castOrUpdatePublicChoiceDecisionVote(
  decisionId: string,
  payload: CastInitiativeDecisionVotePayload,
): Promise<InitiativeDecisionVote> {
  return apiRequest<InitiativeDecisionVote>(
    `/api/v1/initiative-collective-decisions/${encodeURIComponent(decisionId)}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}
