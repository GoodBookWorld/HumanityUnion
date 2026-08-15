import type { InitiativeCollectiveDecisionPersistenceAdapter } from "./initiative-collective-decision-persistence.types.js";
import { createFileInitiativeCollectiveDecisionPersistenceAdapter } from "./initiative-collective-decision-file.persistence.js";
import { createMemoryInitiativeCollectiveDecisionPersistenceAdapter } from "./initiative-collective-decision-memory.persistence.js";
import { createMongoInitiativeCollectiveDecisionPersistenceAdapter } from "./initiative-collective-decision-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeCollectiveDecisionPersistenceAdapter(): InitiativeCollectiveDecisionPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeCollectiveDecisionPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeCollectiveDecisionPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeCollectiveDecisionPersistenceAdapter();
  }
}
