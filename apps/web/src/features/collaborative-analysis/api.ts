import type {
  CollaborativeAnalysis,
  Contribution,
  PublicCollaborativeAnalysisProjection,
  Signal,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function listCollaborativeAnalyses(): Promise<CollaborativeAnalysis[]> {
  return apiRequest<CollaborativeAnalysis[]>("/api/v1/collaborative-analysis");
}

export async function getCollaborativeAnalysisById(
  analysisId: string,
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>(
    `/api/v1/collaborative-analysis/${encodeURIComponent(analysisId)}`,
  );
}

export async function getCollaborativeAnalysisByInitiativeId(
  initiativeId: string,
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/analysis`,
  );
}

export async function getPublicCollaborativeAnalysis(
  analysisId: string,
): Promise<PublicCollaborativeAnalysisProjection> {
  return apiRequest<PublicCollaborativeAnalysisProjection>(
    `/api/v1/public/collaborative-analysis/${encodeURIComponent(analysisId)}`,
  );
}

export async function createCollaborativeAnalysis(
  analysis: CollaborativeAnalysis,
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>("/api/v1/collaborative-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(analysis),
  });
}

export async function addContribution(
  analysisId: string,
  contribution: Contribution,
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>(
    `/api/v1/collaborative-analysis/${encodeURIComponent(analysisId)}/contributions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contribution),
    },
  );
}

export async function addSignal(
  analysisId: string,
  signal: Signal,
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>(
    `/api/v1/collaborative-analysis/${encodeURIComponent(analysisId)}/signals`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signal),
    },
  );
}

export async function updateCollaborativeAnalysis(
  analysisId: string,
  update: Pick<CollaborativeAnalysis, "status"> & {
    progressPolicy?: Partial<CollaborativeAnalysis["progressPolicy"]>;
  },
): Promise<CollaborativeAnalysis> {
  return apiRequest<CollaborativeAnalysis>(
    `/api/v1/collaborative-analysis/${encodeURIComponent(analysisId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    },
  );
}
