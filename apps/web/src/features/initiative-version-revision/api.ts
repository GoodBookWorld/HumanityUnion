import type {
  Initiative,
  InitiativeRevisionDraft,
  InitiativeRevisionDraftContext,
  InitiativeVersionRevision,
  PublicInitiativeVersionRevisionProjection,
  PublicInitiativeWithVersionHistory,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface SaveInitiativeRevisionDraftInput {
  title?: string;
  description?: string;
  communitySlug?: string;
  activityArea?: string;
  revisionSummary?: string;
  appliedProposalIds?: string[];
  skippedProposalIds?: string[];
}

export async function listInitiativeVersionRevisions(
  initiativeId: string,
): Promise<InitiativeVersionRevision[]> {
  return apiRequest<InitiativeVersionRevision[]>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getInitiativeRevisionWorkspace(
  initiativeId: string,
): Promise<InitiativeRevisionDraftContext> {
  return apiRequest<InitiativeRevisionDraftContext>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function createInitiativeRevisionDraft(
  initiativeId: string,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "POST",
    },
  );
}

export async function saveInitiativeRevisionDraft(
  initiativeId: string,
  input: SaveInitiativeRevisionDraftInput,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeRevision(initiativeId: string): Promise<{
  revision: InitiativeVersionRevision;
  initiative: Initiative;
}> {
  return apiRequest<{ revision: InitiativeVersionRevision; initiative: Initiative }>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/publish`,
    {
      method: "POST",
    },
  );
}

export async function getPublicInitiativeVersionHistory(
  initiativeId: string,
): Promise<PublicInitiativeWithVersionHistory> {
  return apiRequest<PublicInitiativeWithVersionHistory>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/revisions`,
  );
}

export async function getPublicInitiativeVersionRevision(
  initiativeId: string,
  version: number,
): Promise<PublicInitiativeVersionRevisionProjection> {
  return apiRequest<PublicInitiativeVersionRevisionProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/revisions/${version}`,
  );
}
