import { MemoryCivicNominationPersistenceAdapter } from "./civic-nomination-memory.persistence.js";
import { createMongoCivicNominationPersistenceAdapter } from "./civic-nomination-mongo.persistence.js";
import type { CivicNominationPersistenceAdapter } from "./civic-nomination-persistence.types.js";

export function resolveCivicNominationPersistenceAdapter(): CivicNominationPersistenceAdapter {
  const mode = process.env.CIVIC_NOMINATION_PERSISTENCE ?? "memory";

  switch (mode) {
    case "mongodb":
      return createMongoCivicNominationPersistenceAdapter();
    case "memory":
    default:
      return new MemoryCivicNominationPersistenceAdapter();
  }
}
