import type {
  InitiativeAnalysisReactionKind,
  InitiativeAnalysisReactionSummary,
  InitiativeAnalysisSourceSnapshot,
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
  /** Initiative Lifecycle — Part B. */
  openQuestions?: string;
  suggestedImprovements: string;
  references: string;
}

export interface SaveInitiativeCollaborativeAnalysisDraftInput {
  title?: string;
  summary?: string;
  supportingEvidence?: string;
  risks?: string;
  /** Initiative Lifecycle — Part B. */
  openQuestions?: string;
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

/**
 * Initiative Lifecycle — Part B. Resolves the ONE canonical Collaborative
 * Analysis the Lifecycle Stage Workspace shows this Author for this
 * Initiative (in-progress draft first, otherwise latest published) — see
 * `getMyInitiativeCollaborativeAnalysisForInitiative` on the API side.
 * Returns `null` when the Author has no Analysis at all yet.
 */
export async function getMyCurrentInitiativeAnalysis(
  initiativeId: string,
): Promise<InitiativeCollaborativeAnalysis | null> {
  return apiRequest<InitiativeCollaborativeAnalysis | null>(
    `/api/v1/initiative-analyses/by-initiative/${encodeURIComponent(initiativeId)}/current`,
  );
}

/** Initiative Lifecycle — Part B, Section 2/3: the Automatic Source Snapshot. */
export async function getInitiativeAnalysisSourceSnapshot(
  initiativeId: string,
): Promise<InitiativeAnalysisSourceSnapshot> {
  return apiRequest<InitiativeAnalysisSourceSnapshot>(
    `/api/v1/initiative-analyses/by-initiative/${encodeURIComponent(initiativeId)}/source-snapshot`,
  );
}

/**
 * Initiative Lifecycle — Part B, Section 4: "Generate Analysis Draft".
 * Creates the Author's draft (if none exists) or overwrites its content
 * wholesale with a fresh deterministic derivation from current sources.
 */
export async function generateInitiativeAnalysisDraft(
  initiativeId: string,
): Promise<InitiativeCollaborativeAnalysis> {
  return apiRequest<InitiativeCollaborativeAnalysis>(
    `/api/v1/initiative-analyses/by-initiative/${encodeURIComponent(initiativeId)}/generate`,
    { method: "POST" },
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

/**
 * Initiative Lifecycle — Part B, Section 9 (Reaction Model). `reaction`
 * of `"none"` clears the caller's existing reaction. Returns the updated
 * summary so the Public Result view can update counts immediately.
 */
export async function setInitiativeAnalysisReaction(
  analysisId: string,
  reaction: InitiativeAnalysisReactionKind | "none",
): Promise<InitiativeAnalysisReactionSummary> {
  const result = await apiRequest<{
    reactionSummary: InitiativeAnalysisReactionSummary;
  }>(`/api/v1/public/initiative-analyses/${encodeURIComponent(analysisId)}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reaction }),
  });

  return result.reactionSummary;
}
