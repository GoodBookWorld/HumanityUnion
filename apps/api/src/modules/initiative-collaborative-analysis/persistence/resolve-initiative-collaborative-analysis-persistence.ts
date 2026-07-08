import type { InitiativeCollaborativeAnalysisPersistenceAdapter } from "./initiative-collaborative-analysis-persistence.types.js";
import { createFileInitiativeCollaborativeAnalysisPersistenceAdapter } from "./initiative-collaborative-analysis-file.persistence.js";
import { createMemoryInitiativeCollaborativeAnalysisPersistenceAdapter } from "./initiative-collaborative-analysis-memory.persistence.js";
import { createMongoInitiativeCollaborativeAnalysisPersistenceAdapter } from "./initiative-collaborative-analysis-mongo.persistence.js";

/**
 * Selects initiative collaborative analysis persistence.
 * Default: local JSON file under apps/api/.runtime/initiative-analyses.json
 */
export function resolveInitiativeCollaborativeAnalysisPersistenceAdapter(): InitiativeCollaborativeAnalysisPersistenceAdapter {
  const mode = process.env.INITIATIVE_ANALYSIS_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeCollaborativeAnalysisPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeCollaborativeAnalysisPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeCollaborativeAnalysisPersistenceAdapter();
  }
}
