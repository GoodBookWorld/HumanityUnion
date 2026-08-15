import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { createFilePublicCivicArchivePersistenceAdapter } from "./public-civic-archive-file.persistence.js";
import { createMemoryPublicCivicArchivePersistenceAdapter } from "./public-civic-archive-memory.persistence.js";
import { createMongoPublicCivicArchivePersistenceAdapter } from "./public-civic-archive-mongo.persistence.js";
import type { PublicCivicArchivePersistenceAdapter } from "./public-civic-archive-persistence.types.js";

function resolvePublicCivicArchivePersistenceMode(): "file" | "memory" | "mongodb" {
  // Production durable contract: mongodb (rejects explicit file/memory).
  if (process.env.NODE_ENV === "production") {
    return resolvePersistenceMode("PUBLIC_CIVIC_ARCHIVE_PERSISTENCE", "mongodb");
  }

  const explicit = process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE?.trim();

  if (explicit === "memory" || explicit === "file" || explicit === "mongodb") {
    return explicit;
  }

  if (isMongoConfigured() && process.env.HU_VERIFICATION_MODE !== "true") {
    if (!explicit) {
      process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE = "mongodb";
    }

    return "mongodb";
  }

  return "file";
}

export function resolvePublicCivicArchivePersistenceAdapter(): PublicCivicArchivePersistenceAdapter {
  const mode = resolvePublicCivicArchivePersistenceMode();

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
