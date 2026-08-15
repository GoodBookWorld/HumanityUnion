import { MemoryOfficialResponsePersistenceAdapter } from "./official-response-memory.persistence.js";
import { FileOfficialResponsePersistenceAdapter } from "./official-response-file.persistence.js";
import { createMongoOfficialResponsePersistenceAdapter } from "./official-response-mongo.persistence.js";
import type { OfficialResponsePersistenceAdapter } from "./official-response-persistence.types.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveOfficialResponsePersistenceAdapter(): OfficialResponsePersistenceAdapter {
  const mode = resolvePersistenceMode("OFFICIAL_RESPONSE_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return new MemoryOfficialResponsePersistenceAdapter();
    case "mongodb":
      return createMongoOfficialResponsePersistenceAdapter();
    case "file":
    default: {
      const filePath = process.env.OFFICIAL_RESPONSE_PERSISTENCE_PATH;

      return filePath
        ? new FileOfficialResponsePersistenceAdapter(filePath)
        : new FileOfficialResponsePersistenceAdapter();
    }
  }
}
