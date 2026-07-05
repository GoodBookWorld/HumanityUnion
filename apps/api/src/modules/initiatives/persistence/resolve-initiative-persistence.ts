import type { InitiativePersistenceAdapter } from "./initiative-persistence.types.js";
import { createFileInitiativePersistenceAdapter } from "./initiative-file.persistence.js";
import { createMemoryInitiativePersistenceAdapter } from "./initiative-memory.persistence.js";

/**
 * Selects initiative persistence for Capability 02 operational storage.
 * Default: local JSON file under apps/api/.runtime/initiatives.json
 */
export function resolveInitiativePersistenceAdapter(): InitiativePersistenceAdapter {
  const mode = process.env.INITIATIVE_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativePersistenceAdapter();
    case "file":
    default:
      return createFileInitiativePersistenceAdapter();
  }
}
