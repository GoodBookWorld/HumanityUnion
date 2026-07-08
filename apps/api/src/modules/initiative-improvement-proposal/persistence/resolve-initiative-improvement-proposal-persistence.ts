import type { InitiativeImprovementProposalPersistenceAdapter } from "./initiative-improvement-proposal-persistence.types.js";
import { createFileInitiativeImprovementProposalPersistenceAdapter } from "./initiative-improvement-proposal-file.persistence.js";
import { createMemoryInitiativeImprovementProposalPersistenceAdapter } from "./initiative-improvement-proposal-memory.persistence.js";
import { createMongoInitiativeImprovementProposalPersistenceAdapter } from "./initiative-improvement-proposal-mongo.persistence.js";

export function resolveInitiativeImprovementProposalPersistenceAdapter(): InitiativeImprovementProposalPersistenceAdapter {
  const mode = process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImprovementProposalPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeImprovementProposalPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImprovementProposalPersistenceAdapter();
  }
}
