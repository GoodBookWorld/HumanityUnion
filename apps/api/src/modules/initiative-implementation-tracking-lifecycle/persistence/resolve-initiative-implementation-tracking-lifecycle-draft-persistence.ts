import type { InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter } from "./initiative-implementation-tracking-lifecycle-draft-persistence.types.js";
import { createFileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter } from "./initiative-implementation-tracking-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter } from "./initiative-implementation-tracking-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter } from "./initiative-implementation-tracking-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter(): InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter();
  }
}
