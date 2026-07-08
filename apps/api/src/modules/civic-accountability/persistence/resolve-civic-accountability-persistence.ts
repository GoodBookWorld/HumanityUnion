import { FileCivicAccountabilityPersistenceAdapter } from "./civic-accountability-file.persistence.js";
import { MemoryCivicAccountabilityPersistenceAdapter } from "./civic-accountability-memory.persistence.js";
import { createMongoCivicAccountabilityPersistenceAdapter } from "./civic-accountability-mongo.persistence.js";
import type { CivicAccountabilityPersistenceAdapter } from "./civic-accountability-persistence.types.js";

export function resolveCivicAccountabilityPersistenceAdapter(): CivicAccountabilityPersistenceAdapter {
  const mode = process.env.CIVIC_ACCOUNTABILITY_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return new MemoryCivicAccountabilityPersistenceAdapter();
    case "mongodb":
      return createMongoCivicAccountabilityPersistenceAdapter();
    case "file":
    default: {
      const filePath = process.env.CIVIC_ACCOUNTABILITY_PERSISTENCE_PATH;

      return filePath
        ? new FileCivicAccountabilityPersistenceAdapter(filePath)
        : new FileCivicAccountabilityPersistenceAdapter();
    }
  }
}
