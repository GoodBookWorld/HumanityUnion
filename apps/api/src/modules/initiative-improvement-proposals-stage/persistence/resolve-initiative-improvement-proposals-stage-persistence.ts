import type { InitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage.types.js";
import { createFileInitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage-file.persistence.js";
import { createMemoryInitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage-memory.persistence.js";
import { createMongoInitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


let cachedAdapter: InitiativeImprovementProposalsStagePersistenceAdapter | null = null;

/**
 * Phase 04 — non-production default is durable file (not process memory).
 * Production/staging durable key forces mongodb via production-persistence-contract.
 * Memory remains available for focused tests via env override.
 */
export function resolveInitiativeImprovementProposalsStagePersistenceAdapter(): InitiativeImprovementProposalsStagePersistenceAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const mode = resolvePersistenceMode("INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE", "file");

  cachedAdapter =
    mode === "mongodb"
      ? createMongoInitiativeImprovementProposalsStagePersistenceAdapter()
      : mode === "memory"
        ? createMemoryInitiativeImprovementProposalsStagePersistenceAdapter()
        : createFileInitiativeImprovementProposalsStagePersistenceAdapter();

  return cachedAdapter;
}

/** Test-only: forces a fresh adapter instance (used to reset in-memory state between test files). */
export function resetInitiativeImprovementProposalsStagePersistenceAdapterForTests(): void {
  cachedAdapter = null;
}
