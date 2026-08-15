import type { InitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-persistence.types.js";
import { createFileInitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-file.persistence.js";
import { createMemoryInitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-memory.persistence.js";
import { createMongoInitiativeVersionRevisionPersistenceAdapter } from "./initiative-version-revision-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeVersionRevisionPersistenceAdapter(): InitiativeVersionRevisionPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_VERSION_REVISION_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeVersionRevisionPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeVersionRevisionPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeVersionRevisionPersistenceAdapter();
  }
}
