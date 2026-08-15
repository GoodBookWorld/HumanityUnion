import type { InitiativePetitionDraftPersistenceAdapter } from "./initiative-petition-draft-persistence.types.js";
import { createFileInitiativePetitionDraftPersistenceAdapter } from "./initiative-petition-draft-file.persistence.js";
import { createMemoryInitiativePetitionDraftPersistenceAdapter } from "./initiative-petition-draft-memory.persistence.js";
import { createMongoInitiativePetitionDraftPersistenceAdapter } from "./initiative-petition-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativePetitionDraftPersistenceAdapter(): InitiativePetitionDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_PETITION_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativePetitionDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativePetitionDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativePetitionDraftPersistenceAdapter();
  }
}
