import type { InitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-persistence.types.js";
import { createFileInitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-file.persistence.js";
import { createMemoryInitiativeImplementationCommitmentPersistenceAdapter } from "./initiative-implementation-commitment-memory.persistence.js";

export function resolveInitiativeImplementationCommitmentPersistenceAdapter(): InitiativeImplementationCommitmentPersistenceAdapter {
  const mode = process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImplementationCommitmentPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImplementationCommitmentPersistenceAdapter();
  }
}
