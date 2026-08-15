import type { InitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./initiative-official-response-lifecycle-draft-persistence.types.js";
import { createFileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./initiative-official-response-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./initiative-official-response-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./initiative-official-response-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeOfficialResponseLifecycleDraftPersistenceAdapter(): InitiativeOfficialResponseLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();
  }
}
