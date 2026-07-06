import type { InitiativeDecisionVotePersistenceAdapter } from "./initiative-decision-vote-persistence.types.js";
import { createFileInitiativeDecisionVotePersistenceAdapter } from "./initiative-decision-vote-file.persistence.js";
import { createMemoryInitiativeDecisionVotePersistenceAdapter } from "./initiative-decision-vote-memory.persistence.js";

export function resolveInitiativeDecisionVotePersistenceAdapter(): InitiativeDecisionVotePersistenceAdapter {
  const mode = process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeDecisionVotePersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeDecisionVotePersistenceAdapter();
  }
}
