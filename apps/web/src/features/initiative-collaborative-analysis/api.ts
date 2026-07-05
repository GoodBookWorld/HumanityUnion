import type {
  InitiativeCollaborativeAnalysis,
  PublicInitiativeCollaborativeAnalysisListItem,
  PublicInitiativeCollaborativeAnalysisProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface CreateInitiativeCollaborativeAnalysisDraftInput {
  initiativeId: string;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  suggestedImprovements: string;
  references: string;
}

export interface SaveInitiativeCollaborativeAnalysisDraftInput {
  title?: string;
  summary?: string;
  supportingEvidence?: string;
  risks?: string;
  suggestedImprovements?: string;
  references?: string;
}

export async function listMyInitiativeAnalyses(): Promise<InitiativeCollaborativeAnalysis[]> {
  return apiRequest<InitiativeCollaborativeAnalysis[]>("/api/v1/initiative-analyses/mine");
}

export async function listMyInitiativeAnalysesForInitiative(
  initiativeId: string,
): Promise<InitiativeCollaborativeAnalysis[]> {
  return apiRequest<InitiativeCollaborativeAnalysis[]>(
    `/api/v1/initiative-analyses/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getInitiativeAnalysisById(
  analysisId: string,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>(
    `/api/v1/initiative-analyses/${encodeURIComponent(analysisId)}`,
  );
}

export async function createInitiativeAnalysisDraft(
  input: CreateInitiativeCollaborativeAnalysisDraftInput,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>("/api/v1/initiative-analyses/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function saveInitiativeAnalysisDraft(
  analysisId: string,
  input: SaveInitiativeCollaborativeAnalysisDraftInput,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>(
    `/api/v1/initiative-analyses/${encodeURIComponent(analysisId)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeAnalysis(
  analysisId: string,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>(
    `/api/v1/initiative-analyses/${encodeURIComponent(analysisId)}/publish`,
    {
      method: "POST",
    },
  );
}

export async function archiveInitiativeAnalysis(
  analysisId: string,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>(
    `/api/v1/initiative-analyses/${encodeURIComponent(analysisId)}/archive`,
    {
      method: "POST",
    },
  );
}

export async function listPublicInitiativeAnalyses(
  initiativeId: string,
): Promise<PublicInitiativeCollaborativeAnalysisListItem[]> {
  return apiRequest<PublicInitiativeCollaborativeAnalysisListItem[]>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/analyses`,
  );
}

export async function getPublicInitiativeAnalysis(
  analysisId: string,
): Promise<PublicInitiativeCollaborativeAnalysisProjection> {
  return apiRequest<PublicInitiativeCollaborativeAnalysisProjection>(
    `/api/v1/public/initiative-analyses/${encodeURIComponent(analysisId)}`,
  );
}
