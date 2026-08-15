import type { InitiativePersistenceAdapter } from "./initiative-persistence.types.js";
import { createFileInitiativePersistenceAdapter } from "./initiative-file.persistence.js";
import { createMemoryInitiativePersistenceAdapter } from "./initiative-memory.persistence.js";
import { createMongoInitiativePersistenceAdapter } from "./initiative-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


/**
 * Selects initiative persistence for Capability 02 operational storage.
 * Default: local JSON file under apps/api/.runtime/initiatives.json
 */
export function resolveInitiativePersistenceAdapter(): InitiativePersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativePersistenceAdapter();
    case "mongodb":
      return createMongoInitiativePersistenceAdapter();
    case "file":
    default:
      return createFileInitiativePersistenceAdapter();
  }
}
