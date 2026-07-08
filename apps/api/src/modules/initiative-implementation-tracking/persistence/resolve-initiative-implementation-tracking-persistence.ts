import type { InitiativeImplementationTrackingPersistenceAdapter } from "./initiative-implementation-tracking-persistence.types.js";
import { createFileInitiativeImplementationTrackingPersistenceAdapter } from "./initiative-implementation-tracking-file.persistence.js";
import { createMemoryInitiativeImplementationTrackingPersistenceAdapter } from "./initiative-implementation-tracking-memory.persistence.js";
import { createMongoInitiativeImplementationTrackingPersistenceAdapter } from "./initiative-implementation-tracking-mongo.persistence.js";

export function resolveInitiativeImplementationTrackingPersistenceAdapter(): InitiativeImplementationTrackingPersistenceAdapter {
  const mode = process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativeImplementationTrackingPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeImplementationTrackingPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeImplementationTrackingPersistenceAdapter();
  }
}
