import type { InitiativeCollaborativeAnalysis } from "@hu/types";

export interface InitiativeCollaborativeAnalysisPersistenceSnapshot {
  version: 1;
  analyses: Record<string, InitiativeCollaborativeAnalysis>;
}

export interface InitiativeCollaborativeAnalysisPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeCollaborativeAnalysisPersistenceSnapshot;
  save(snapshot: InitiativeCollaborativeAnalysisPersistenceSnapshot): void;
}

export function createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot(): InitiativeCollaborativeAnalysisPersistenceSnapshot {
  return {
    version: 1,
    analyses: {},
  };
}

export function snapshotFromAnalyses(
  analyses: Map<string, InitiativeCollaborativeAnalysis>,
): InitiativeCollaborativeAnalysisPersistenceSnapshot {
  const record: Record<string, InitiativeCollaborativeAnalysis> = {};

  for (const [analysisId, analysis] of analyses) {
    record[analysisId] = structuredClone(analysis);
  }

  return {
    version: 1,
    analyses: record,
  };
}
