import type { DecisionSessionPersistenceAdapter } from "./decision-session-persistence.types.js";
import { createFileDecisionSessionPersistenceAdapter } from "./decision-session-file.persistence.js";
import { createMemoryDecisionSessionPersistenceAdapter } from "./decision-session-memory.persistence.js";

export function resolveDecisionSessionPersistenceAdapter(): DecisionSessionPersistenceAdapter {
  const mode = process.env.DECISION_SESSION_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryDecisionSessionPersistenceAdapter();
    case "file":
    default:
      return createFileDecisionSessionPersistenceAdapter();
  }
}
