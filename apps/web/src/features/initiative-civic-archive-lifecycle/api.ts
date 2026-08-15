import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveLifecycleDraftContext,
  InitiativeCivicArchiveVersion,
  InitiativeLifecycleArchiveDocument,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeCivicArchiveWorkspace(
  initiativeId: string,
): Promise<InitiativeCivicArchiveLifecycleDraftContext> {
  return apiRequest<InitiativeCivicArchiveLifecycleDraftContext>(
    `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function generateInitiativeCivicArchiveDraft(
  initiativeId: string,
): Promise<InitiativeCivicArchiveLifecycleDraft> {
  return apiRequest<InitiativeCivicArchiveLifecycleDraft>(
    `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

export async function saveInitiativeCivicArchiveDraft(
  initiativeId: string,
  input: Partial<
    Pick<
      InitiativeCivicArchiveLifecycleDraft,
      "finalArchiveTitle" | "finalSummary" | "lessonsLearned" | "knowledgeContribution"
    >
  >,
): Promise<InitiativeCivicArchiveLifecycleDraft> {
  return apiRequest<InitiativeCivicArchiveLifecycleDraft>(
    `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeCivicArchiveStage(
  initiativeId: string,
): Promise<InitiativeCivicArchiveVersion> {
  return apiRequest<InitiativeCivicArchiveVersion>(
    `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

export async function getPublishedInitiativeCivicArchive(
  initiativeId: string,
): Promise<{
  version: InitiativeCivicArchiveVersion;
  document: InitiativeLifecycleArchiveDocument;
} | null> {
  return apiRequest<{
    version: InitiativeCivicArchiveVersion;
    document: InitiativeLifecycleArchiveDocument;
  } | null>(
    `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/published`,
  );
}

export function getPublishedCivicArchivePdfUrl(initiativeId: string): string {
  return `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/document.pdf`;
}

export function getDraftCivicArchivePdfUrl(initiativeId: string): string {
  return `/api/v1/initiative-civic-archive-lifecycle/initiative/${encodeURIComponent(initiativeId)}/draft/document.pdf`;
}

export function getCivicArchivePublicSharePath(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#civic-archive`;
}
