import type { EvidenceKind, Implementation, PublicImplementationProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getImplementationById(implementationId: string): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/${encodeURIComponent(implementationId)}`,
  );
}

export async function getImplementationByCommitmentId(
  commitmentId: string,
): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/by-commitment/${encodeURIComponent(commitmentId)}`,
  );
}

export async function getImplementationByInitiativeId(
  initiativeId: string,
): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getImplementationByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/by-collective-decision/${encodeURIComponent(collectiveDecisionId)}`,
  );
}

export async function getImplementationByPetitionId(petitionId: string): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/by-petition/${encodeURIComponent(petitionId)}`,
  );
}

export async function listImplementations(): Promise<Implementation[]> {
  return apiRequest<Implementation[]>("/api/v1/implementations");
}

export async function getPublicImplementation(
  implementationId: string,
): Promise<PublicImplementationProjection> {
  return apiRequest<PublicImplementationProjection>(
    `/api/v1/public/implementations/${encodeURIComponent(implementationId)}`,
  );
}

export interface RecordAchievementRequest {
  achievementId: string;
  milestoneId: string;
  title: string;
  summary: string;
  recordedByParticipantId: string;
}

export async function recordAchievement(
  implementationId: string,
  input: RecordAchievementRequest,
): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/${encodeURIComponent(implementationId)}/achievements`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export interface AttachEvidenceRequest {
  evidenceId: string;
  evidenceKind: EvidenceKind;
  label: string;
  reference?: {
    referenceId: string;
    referenceType: string;
    displayLabel: string;
  } | null;
  attachment?: {
    attachmentId: string;
    mediaType: string;
    displayLabel: string;
    storageReference?: string | null;
  } | null;
  link?: {
    url: string;
    displayLabel: string;
    linkKind: string;
  } | null;
}

export async function attachEvidence(
  implementationId: string,
  achievementId: string,
  input: AttachEvidenceRequest,
): Promise<Implementation> {
  return apiRequest<Implementation>(
    `/api/v1/implementations/${encodeURIComponent(implementationId)}/achievements/${encodeURIComponent(achievementId)}/evidence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}
