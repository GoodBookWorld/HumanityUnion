import type { InitiativePublicImpactPersistenceAdapter } from "./initiative-public-impact-persistence.types.js";
import { createFileInitiativePublicImpactPersistenceAdapter } from "./initiative-public-impact-file.persistence.js";
import { createMemoryInitiativePublicImpactPersistenceAdapter } from "./initiative-public-impact-memory.persistence.js";
import { createMongoInitiativePublicImpactPersistenceAdapter } from "./initiative-public-impact-mongo.persistence.js";

export function resolveInitiativePublicImpactPersistenceAdapter(): InitiativePublicImpactPersistenceAdapter {
  const mode = process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryInitiativePublicImpactPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativePublicImpactPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativePublicImpactPersistenceAdapter();
  }
}
