import type { InitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-persistence.types.js";
import { createFileInitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-file.persistence.js";
import { createMemoryInitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-memory.persistence.js";
import { createMongoInitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeImplementationCommitmentPersistenceAdapter(): InitiativeImplementationCommitmentPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImplementationCommitmentPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeImplementationCommitmentPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImplementationCommitmentPersistenceAdapter();
  }
}
