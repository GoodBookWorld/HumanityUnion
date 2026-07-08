import { MemoryCivicActionPackagePersistenceAdapter } from "./civic-action-package-memory.persistence.js";
import { FileCivicActionPackagePersistenceAdapter } from "./civic-action-package-file.persistence.js";
import { createMongoCivicActionPackagePersistenceAdapter } from "./civic-action-package-mongo.persistence.js";
import type { CivicActionPackagePersistenceAdapter } from "./civic-action-package-persistence.types.js";

export function resolveCivicActionPackagePersistenceAdapter(): CivicActionPackagePersistenceAdapter {
  const mode = process.env.CIVIC_ACTION_PACKAGE_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return new MemoryCivicActionPackagePersistenceAdapter();
    case "mongodb":
      return createMongoCivicActionPackagePersistenceAdapter();
    case "file":
    default: {
      const filePath = process.env.CIVIC_ACTION_PACKAGE_PERSISTENCE_PATH;

      return filePath
        ? new FileCivicActionPackagePersistenceAdapter(filePath)
        : new FileCivicActionPackagePersistenceAdapter();
    }
  }
}
