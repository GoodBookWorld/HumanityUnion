import type { InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter } from "./initiative-collective-decision-lifecycle-draft-persistence.types.js";
import { createFileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter } from "./initiative-collective-decision-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter } from "./initiative-collective-decision-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter } from "./initiative-collective-decision-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter(): InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter();
  }
}
