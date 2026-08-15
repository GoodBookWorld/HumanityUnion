import type { InitiativePublicImpactLifecycleDraftPersistenceAdapter } from "./initiative-public-impact-lifecycle-draft-persistence.types.js";
import { createFileInitiativePublicImpactLifecycleDraftPersistenceAdapter } from "./initiative-public-impact-lifecycle-draft-file.persistence.js";
import { createMemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter } from "./initiative-public-impact-lifecycle-draft-memory.persistence.js";
import { createMongoInitiativePublicImpactLifecycleDraftPersistenceAdapter } from "./initiative-public-impact-lifecycle-draft-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveInitiativePublicImpactLifecycleDraftPersistenceAdapter(): InitiativePublicImpactLifecycleDraftPersistenceAdapter {
  const mode = resolvePersistenceMode("INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativePublicImpactLifecycleDraftPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativePublicImpactLifecycleDraftPersistenceAdapter();
  }
}
