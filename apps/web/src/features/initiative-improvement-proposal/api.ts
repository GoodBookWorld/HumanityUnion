import type {
  InitiativeImprovementProposal,
  InitiativeImprovementProposalMetrics,
  PublicInitiativeImprovementProposalListItem,
  PublicInitiativeImprovementProposalProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface CreateInitiativeImprovementProposalDraftInput {
  analysisId: string;
  targetSection: string;
  currentIssue: string;
  proposedChange: string;
  rationale: string;
  expectedImprovement: string;
  references: string;
}

export interface SaveInitiativeImprovementProposalDraftInput {
  targetSection?: string;
  currentIssue?: string;
  proposedChange?: string;
  rationale?: string;
  expectedImprovement?: string;
  references?: string;
}

export interface DecideInitiativeImprovementProposalInput {
  decision: "accepted" | "partially_accepted" | "declined";
  decisionNote: string;
}

export interface PublicInitiativeImprovementProposalsResponse {
  proposals: PublicInitiativeImprovementProposalListItem[];
  metrics: InitiativeImprovementProposalMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listMyImprovementProposals(): Promise<InitiativeImprovementProposal[]> {
  return apiRequest<InitiativeImprovementProposal[]>("/api/v1/improvement-proposals/mine");
}

export async function listMyImprovementProposalsForInitiative(
  initiativeId: string,
): Promise<InitiativeImprovementProposal[]> {
  return apiRequest<InitiativeImprovementProposal[]>(
    `/api/v1/improvement-proposals/by-initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function listMyImprovementProposalsForAnalysis(
  analysisId: string,
): Promise<InitiativeImprovementProposal[]> {
  return apiRequest<InitiativeImprovementProposal[]>(
    `/api/v1/improvement-proposals/by-analysis/${encodeURIComponent(analysisId)}`,
  );
}

export async function listSubmittedImprovementProposalsForSteward(
  initiativeId: string,
): Promise<InitiativeImprovementProposal[]> {
  return apiRequest<InitiativeImprovementProposal[]>(
    `/api/v1/improvement-proposals/steward/${encodeURIComponent(initiativeId)}/submitted`,
  );
}

export async function createImprovementProposalDraft(
  input: CreateInitiativeImprovementProposalDraftInput,
): Promise<InitiativeImprovementProposal> {
  return apiRequest<InitiativeImprovementProposal>("/api/v1/improvement-proposals/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function saveImprovementProposalDraft(
  proposalId: string,
  input: SaveInitiativeImprovementProposalDraftInput,
): Promise<InitiativeImprovementProposal> {
  return apiRequest<InitiativeImprovementProposal>(
    `/api/v1/improvement-proposals/${encodeURIComponent(proposalId)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function submitImprovementProposal(
  proposalId: string,
): Promise<InitiativeImprovementProposal> {
  return apiRequest<InitiativeImprovementProposal>(
    `/api/v1/improvement-proposals/${encodeURIComponent(proposalId)}/submit`,
    {
      method: "POST",
    },
  );
}

export async function archiveImprovementProposal(
  proposalId: string,
): Promise<InitiativeImprovementProposal> {
  return apiRequest<InitiativeImprovementProposal>(
    `/api/v1/improvement-proposals/${encodeURIComponent(proposalId)}/archive`,
    {
      method: "POST",
    },
  );
}

export async function decideImprovementProposal(
  proposalId: string,
  input: DecideInitiativeImprovementProposalInput,
): Promise<InitiativeImprovementProposal> {
  return apiRequest<InitiativeImprovementProposal>(
    `/api/v1/improvement-proposals/${encodeURIComponent(proposalId)}/decide`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function listPublicInitiativeImprovementProposals(
  initiativeId: string,
): Promise<PublicInitiativeImprovementProposalsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/improvement-proposals`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    success: boolean;
    data: PublicInitiativeImprovementProposalListItem[];
    meta: { metrics?: InitiativeImprovementProposalMetrics };
    message: string;
  };

  if (!body.success) {
    throw new Error(body.message || "API request failed");
  }

  return {
    proposals: body.data,
    metrics: body.meta.metrics ?? {
      submittedCount: 0,
      acceptedCount: 0,
      partiallyAcceptedCount: 0,
      declinedCount: 0,
    },
  };
}

export async function listPublicImprovementProposalsForAnalysis(
  analysisId: string,
): Promise<PublicInitiativeImprovementProposalListItem[]> {
  return apiRequest<PublicInitiativeImprovementProposalListItem[]>(
    `/api/v1/public/initiative-analyses/${encodeURIComponent(analysisId)}/improvement-proposals`,
  );
}

export async function getPublicImprovementProposal(
  proposalId: string,
): Promise<PublicInitiativeImprovementProposalProjection> {
  return apiRequest<PublicInitiativeImprovementProposalProjection>(
    `/api/v1/public/improvement-proposals/${encodeURIComponent(proposalId)}`,
  );
}
