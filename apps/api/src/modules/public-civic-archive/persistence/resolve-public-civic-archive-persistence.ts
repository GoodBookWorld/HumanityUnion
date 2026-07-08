import { createFilePublicCivicArchivePersistenceAdapter } from "./public-civic-archive-file.persistence.js";
import { createMemoryPublicCivicArchivePersistenceAdapter } from "./public-civic-archive-memory.persistence.js";
import { createMongoPublicCivicArchivePersistenceAdapter } from "./public-civic-archive-mongo.persistence.js";
import type { PublicCivicArchivePersistenceAdapter } from "./public-civic-archive-persistence.types.js";

export function resolvePublicCivicArchivePersistenceAdapter(): PublicCivicArchivePersistenceAdapter {
  const mode = process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryPublicCivicArchivePersistenceAdapter();
    case "mongodb":
      return createMongoPublicCivicArchivePersistenceAdapter();
    case "file":
    default:
      return createFilePublicCivicArchivePersistenceAdapter();
  }
}
