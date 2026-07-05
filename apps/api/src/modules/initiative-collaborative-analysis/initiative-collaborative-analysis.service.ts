import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { assertInitiativeCollaborativeAnalysisOwnership } from "./initiative-collaborative-analysis-ownership.js";
import {
  createAnalysis,
  getAnalysisById,
  listAnalysesByAuthor,
  listAnalysesByInitiative,
  updateAnalysis,
} from "./initiative-collaborative-analysis.store.js";
import {
  type CreateInitiativeCollaborativeAnalysisDraftInput,
  type SaveInitiativeCollaborativeAnalysisDraftInput,
  validateInitiativeCollaborativeAnalysisForPublication,
} from "./initiative-collaborative-analysis.validators.js";

function assertEligibleInitiative(initiativeId: string): void {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  if (initiative.lifecyclePhase !== "published" && initiative.lifecyclePhase !== "projected") {
    throw new Error("Analysis can only be created for published or projected initiatives.");
  }
}

function getOwnedAnalysis(
  analysisId: string,
  identity: RequestIdentity,
): InitiativeCollaborativeAnalysis {
  const analysis = getAnalysisById(analysisId);

  if (!analysis) {
    throw new Error("Analysis not found.");
  }

  assertInitiativeCollaborativeAnalysisOwnership(analysis, identity);

  return analysis;
}

function assertDraftStatus(analysis: InitiativeCollaborativeAnalysis): void {
  if (analysis.status !== "draft") {
    throw new Error("Only draft analyses can be edited or published from this workflow.");
  }
}

function assertArchivableStatus(analysis: InitiativeCollaborativeAnalysis): void {
  if (analysis.status === "archived") {
    throw new Error("Analysis is already archived.");
  }
}

function applyAnalysisContentUpdate(
  analysis: InitiativeCollaborativeAnalysis,
  input: SaveInitiativeCollaborativeAnalysisDraftInput,
): SaveInitiativeCollaborativeAnalysisDraftInput {
  return {
    title: input.title ?? analysis.title,
    summary: input.summary ?? analysis.summary,
    supportingEvidence: input.supportingEvidence ?? analysis.supportingEvidence,
    risks: input.risks ?? analysis.risks,
    suggestedImprovements: input.suggestedImprovements ?? analysis.suggestedImprovements,
    references: input.references ?? analysis.references,
  };
}

export function listMyInitiativeCollaborativeAnalyses(
  identity: RequestIdentity,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByAuthor(identity.participantId);
}

export function listMyInitiativeCollaborativeAnalysesForInitiative(
  identity: RequestIdentity,
  initiativeId: string,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByInitiative(initiativeId).filter(
    (analysis) => analysis.authorId === identity.participantId,
  );
}

export function getMyInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeCollaborativeAnalysis {
  return getOwnedAnalysis(analysisId, identity);
}

export function createInitiativeCollaborativeAnalysisDraft(
  identity: RequestIdentity,
  input: CreateInitiativeCollaborativeAnalysisDraftInput,
): InitiativeCollaborativeAnalysis {
  assertEligibleInitiative(input.initiativeId);

  const now = new Date().toISOString();
  const analysisId = `initiative-analysis-${Date.now()}`;

  const analysis: InitiativeCollaborativeAnalysis = {
    analysisId,
    initiativeId: input.initiativeId,
    authorId: identity.participantId,
    title: input.title,
    summary: input.summary,
    supportingEvidence: input.supportingEvidence,
    risks: input.risks,
    suggestedImprovements: input.suggestedImprovements,
    references: input.references,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createAnalysis(analysis);
}

export function saveInitiativeCollaborativeAnalysisDraft(
  identity: RequestIdentity,
  analysisId: string,
  input: SaveInitiativeCollaborativeAnalysisDraftInput,
): InitiativeCollaborativeAnalysis {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertDraftStatus(analysis);

  const updated = updateAnalysis(analysisId, input);

  if (!updated) {
    throw new Error("Analysis not found.");
  }

  return updated;
}

export function publishInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeCollaborativeAnalysis {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertDraftStatus(analysis);

  const content = applyAnalysisContentUpdate(analysis, {});
  validateInitiativeCollaborativeAnalysisForPublication({
    ...analysis,
    ...content,
  });

  const publishedAt = new Date().toISOString();
  const published = updateAnalysis(analysisId, {
    status: "published",
    publishedAt,
  });

  if (!published) {
    throw new Error("Analysis not found.");
  }

  return published;
}

export function archiveInitiativeCollaborativeAnalysis(
  identity: RequestIdentity,
  analysisId: string,
): InitiativeCollaborativeAnalysis {
  const analysis = getOwnedAnalysis(analysisId, identity);

  assertArchivableStatus(analysis);

  const archived = updateAnalysis(analysisId, {
    status: "archived",
  });

  if (!archived) {
    throw new Error("Analysis not found.");
  }

  return archived;
}
