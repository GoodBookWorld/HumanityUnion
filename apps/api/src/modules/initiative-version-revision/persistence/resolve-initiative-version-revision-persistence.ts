import type { InitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-persistence.types.js";
import { createFileInitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-file.persistence.js";
import { createMemoryInitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-memory.persistence.js";

export function resolveInitiativeVersionRevisionPersistenceAdapter(): InitiativeVersionRevisionPersistenceAdapter {
  const mode = process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeVersionRevisionPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeVersionRevisionPersistenceAdapter();
  }
}
