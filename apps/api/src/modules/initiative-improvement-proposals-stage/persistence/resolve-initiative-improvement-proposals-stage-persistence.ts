import type { InitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage.types.js";
import { createMemoryInitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage-memory.persistence.js";
import { createMongoInitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


let cachedAdapter: InitiativeImprovementProposalsStagePersistenceAdapter | null = null;

/** Mirrors `resolve-reminder-persistence.ts` — same env-driven memory/mongodb selection, same default (memory). */
export function resolveInitiativeImprovementProposalsStagePersistenceAdapter(): InitiativeImprovementProposalsStagePersistenceAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const mode = resolvePersistenceMode("INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE", "memory");

  cachedAdapter =
    mode === "mongodb"
      ? createMongoInitiativeImprovementProposalsStagePersistenceAdapter()
      : createMemoryInitiativeImprovementProposalsStagePersistenceAdapter();

  return cachedAdapter;
}

/** Test-only: forces a fresh adapter instance (used to reset in-memory state between test files). */
export function resetInitiativeImprovementProposalsStagePersistenceAdapterForTests(): void {
  cachedAdapter = null;
}
