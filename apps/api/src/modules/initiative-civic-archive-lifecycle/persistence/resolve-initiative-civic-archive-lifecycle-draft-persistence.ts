import type { InitiativeCivicArchiveLifecycleDraftPersistenceAdapter } from "./initiative-civic-archive-lifecycle-draft-persistence.types.js";
import { createFileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter } from "./initiative-civic-archive-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter } from "./initiative-civic-archive-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativeCivicArchiveLifecycleDraftPersistenceAdapter } from "./initiative-civic-archive-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeCivicArchiveLifecycleDraftPersistenceAdapter(): InitiativeCivicArchiveLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeCivicArchiveLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter();
  }
}
