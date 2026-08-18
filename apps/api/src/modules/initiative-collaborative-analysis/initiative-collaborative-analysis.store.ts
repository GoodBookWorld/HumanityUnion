import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { resolveInitiativeCollaborativeAnalysisPersistenceAdapter } from "./persistence/resolve-initiative-collaborative-analysis-persistence.js";
import { snapshotFromAnalyses } from "./persistence/initiative-collaborative-analysis-persistence.types.js";

export interface InitiativeCollaborativeAnalysisUpdate {
  title?: string;
  summary?: string;
  supportingEvidence?: string;
  risks?: string;
  openQuestions?: string;
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

function persistAnalysesMap(analysesMap: Map<string, InitiativeCollaborativeAnalysis>): void {
  persistence.save(snapshotFromAnalyses(analysesMap));
}

const analyses = loadAnalysesMap();

/**
 * Re-bind the Collaborative Analysis store from the Mongo adapter cache after
 * hydrate. Mirrors `syncInitiativeStoreAfterMongoHydrate` so published
 * analyses survive process restart and feed lifecycle nav + Public Preview
 * from the same in-memory map.
 */
export function syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate(): void {
  if (persistence.mode !== "mongodb") {
    return;
  }

  const reloaded = loadAnalysesMap();
  analyses.clear();
  for (const [analysisId, analysis] of reloaded) {
    analyses.set(analysisId, analysis);
  }
}

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

/**
 * Initiative Lifecycle — Part B. Scopes analyses to one specific author for
 * one specific Initiative — used by the Lifecycle Stage Workspace to find
 * "the Author's own Collaborative Analysis" without picking up another
 * participant's analysis of the same Initiative (the pre-existing
 * multi-author "Collective Intelligence" model this domain already
 * supports, left otherwise untouched).
 */
export function listAnalysesByInitiativeAndAuthor(
  initiativeId: string,
  authorId: string,
): InitiativeCollaborativeAnalysis[] {
  return listAnalysesByInitiative(initiativeId).filter((analysis) => analysis.authorId === authorId);
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

/**
 * Test-only cleanup: removes analyses created by a given authorId. Used by
 * focused ancestry tests (Recovery Task 06) to avoid leaving fixture
 * records behind in the persisted store.
 */
export function deleteAnalysesByAuthorIdForTests(authorId: string): number {
  let deleted = 0;

  for (const [analysisId, analysis] of analyses) {
    if (analysis.authorId === authorId) {
      analyses.delete(analysisId);
      deleted += 1;
    }
  }

  if (deleted > 0) {
    persistAnalysesMap(analyses);
  }

  return deleted;
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

  if (update.openQuestions !== undefined) {
    analysis.openQuestions = update.openQuestions;
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
