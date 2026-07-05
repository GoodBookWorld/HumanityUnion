import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { resolveInitiativeCollaborativeAnalysisPersistenceAdapter } from "./persistence/resolve-initiative-collaborative-analysis-persistence.js";
import { snapshotFromAnalyses } from "./persistence/initiative-collaborative-analysis-persistence.types.js";

export interface InitiativeCollaborativeAnalysisUpdate {
  title?: string;
  summary?: string;
  supportingEvidence?: string;
  risks?: string;
  suggestedImprovements?: string;
  references?: string;
  status?: InitiativeCollaborativeAnalysis["status"];
  publishedAt?: string;
}

const persistence = resolveInitiativeCollaborativeAnalysisPersistenceAdapter();

function loadAnalysesMap(): Map<string, InitiativeCollaborativeAnalysis> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeCollaborativeAnalysis>(
    Object.entries(snapshot.analyses).map(([analysisId, analysis]) => {
      const normalized = structuredClone(analysis);

      if (normalized.initiativeVersion === undefined) {
        normalized.initiativeVersion = 1;
      }

      return [analysisId, normalized];
    }),
  );
}

function persistAnalysesMap(analyses: Map<string, InitiativeCollaborativeAnalysis>): void {
  persistence.save(snapshotFromAnalyses(analyses));
}

const analyses = loadAnalysesMap();

export function getAnalysisById(analysisId: string): InitiativeCollaborativeAnalysis | null {
  const analysis = analyses.get(analysisId);

  return analysis ? structuredClone(analysis) : null;
}

export function listAnalyses(): InitiativeCollaborativeAnalysis[] {
  return Array.from(analyses.values(), (analysis) => structuredClone(analysis));
}

export function listAnalysesByAuthor(authorId: string): InitiativeCollaborativeAnalysis[] {
  return listAnalyses().filter((analysis) => analysis.authorId === authorId);
}

export function listAnalysesByInitiative(initiativeId: string): InitiativeCollaborativeAnalysis[] {
  return listAnalyses().filter((analysis) => analysis.initiativeId === initiativeId);
}

export function listPublishedAnalysesByInitiative(
  initiativeId: string,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByInitiative(initiativeId)
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => {
      const leftTime = left.publishedAt ?? left.updatedAt;
      const rightTime = right.publishedAt ?? right.updatedAt;
      return rightTime.localeCompare(leftTime);
    });
}

export function createAnalysis(
  analysis: InitiativeCollaborativeAnalysis,
): InitiativeCollaborativeAnalysis {
  analyses.set(analysis.analysisId, structuredClone(analysis));
  persistAnalysesMap(analyses);

  return structuredClone(analysis);
}

export function updateAnalysis(
  analysisId: string,
  update: InitiativeCollaborativeAnalysisUpdate,
): InitiativeCollaborativeAnalysis | null {
  const analysis = analyses.get(analysisId);

  if (!analysis) {
    return null;
  }

  if (update.title !== undefined) {
    analysis.title = update.title;
  }

  if (update.summary !== undefined) {
    analysis.summary = update.summary;
  }

  if (update.supportingEvidence !== undefined) {
    analysis.supportingEvidence = update.supportingEvidence;
  }

  if (update.risks !== undefined) {
    analysis.risks = update.risks;
  }

  if (update.suggestedImprovements !== undefined) {
    analysis.suggestedImprovements = update.suggestedImprovements;
  }

  if (update.references !== undefined) {
    analysis.references = update.references;
  }

  if (update.status !== undefined) {
    analysis.status = update.status;
  }

  if (update.publishedAt !== undefined) {
    analysis.publishedAt = update.publishedAt;
  }

  analysis.updatedAt = new Date().toISOString();

  persistAnalysesMap(analyses);

  return structuredClone(analysis);
}
