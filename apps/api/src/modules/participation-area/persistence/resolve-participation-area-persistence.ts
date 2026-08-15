import type { ParticipationAreaPersistenceAdapter } from "./participation-area-persistence.types.js";
import { createFileParticipationAreaPersistenceAdapter } from "./participation-area-file.persistence.js";
import { createMemoryParticipationAreaPersistenceAdapter } from "./participation-area-memory.persistence.js";
import { createMongoParticipationAreaPersistenceAdapter } from "./participation-area-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


export function resolveParticipationAreaPersistenceAdapter(): ParticipationAreaPersistenceAdapter {
  const mode = resolvePersistenceMode("PARTICIPATION_AREA_PERSISTENCE", "file");

  switch (mode) {
    case "memory":
      return createMemoryParticipationAreaPersistenceAdapter();
    case "mongodb":
      return createMongoParticipationAreaPersistenceAdapter();
    case "file":
    default:
      return createFileParticipationAreaPersistenceAdapter();
  }
}
