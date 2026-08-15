import type { InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter } from "./initiative-implementation-commitment-lifecycle-draft-persistence.types.js";
import { createFileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter } from "./initiative-implementation-commitment-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter } from "./initiative-implementation-commitment-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter } from "./initiative-implementation-commitment-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter(): InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter();
  }
}
