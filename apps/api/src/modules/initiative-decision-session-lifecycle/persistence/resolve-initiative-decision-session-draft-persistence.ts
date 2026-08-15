import type { InitiativeDecisionSessionDraftPersistenceAdapter } from "./initiative-decision-session-draft-persistence.types.js";
import { createFileInitiativeDecisionSessionDraftPersistenceAdapter } from "./initiative-decision-session-draft-file.persistence.js";
import { createMemoryInitiativeDecisionSessionDraftPersistenceAdapter } from "./initiative-decision-session-draft-memory.persistence.js";
import { createMongoInitiativeDecisionSessionDraftPersistenceAdapter } from "./initiative-decision-session-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeDecisionSessionDraftPersistenceAdapter(): InitiativeDecisionSessionDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeDecisionSessionDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeDecisionSessionDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeDecisionSessionDraftPersistenceAdapter();
  }
}
