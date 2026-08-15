import type { DecisionSessionPersistenceAdapter } from "./decision-session-persistence.types.js";
import { createFileDecisionSessionPersistenceAdapter } from "./decision-session-file.persistence.js";
import { createMemoryDecisionSessionPersistenceAdapter } from "./decision-session-memory.persistence.js";
import { createMongoDecisionSessionPersistenceAdapter } from "./decision-session-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveDecisionSessionPersistenceAdapter(): DecisionSessionPersistenceAdapter {
  const mode = resolvePersistenceMode("DECISION_SESSION_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryDecisionSessionPersistenceAdapter();
    case "mongodb":
      return createMongoDecisionSessionPersistenceAdapter();
    case "file":
    default:
      return createFileDecisionSessionPersistenceAdapter();
  }
}
