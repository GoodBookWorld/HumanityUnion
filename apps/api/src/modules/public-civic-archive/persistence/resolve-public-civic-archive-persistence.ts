import { createFilePublicCivicArchivePersistenceAdapter } from "./public-civic-archive-file.persistence.js";
import { createMemoryPublicCivicArchivePersistenceAdapter } from "./public-civic-archive-memory.persistence.js";
import type { PublicCivicArchivePersistenceAdapter } from "./public-civic-archive-persistence.types.js";

export function resolvePublicCivicArchivePersistenceAdapter(): PublicCivicArchivePersistenceAdapter {
  const mode = process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE ?? "file";

  if (mode === "memory") {
    return createMemoryPublicCivicArchivePersistenceAdapter();
  }

  return createFilePublicCivicArchivePersistenceAdapter();
}
