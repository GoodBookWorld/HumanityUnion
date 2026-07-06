import type { ParticipationAreaPersistenceAdapter } from "./participation-area-persistence.types.js";
import { createFileParticipationAreaPersistenceAdapter } from "./participation-area-file.persistence.js";
import { createMemoryParticipationAreaPersistenceAdapter } from "./participation-area-memory.persistence.js";

export function resolveParticipationAreaPersistenceAdapter(): ParticipationAreaPersistenceAdapter {
  const mode = process.env.PARTICIPATION_AREA_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryParticipationAreaPersistenceAdapter();
    case "file":
    default:
      return createFileParticipationAreaPersistenceAdapter();
  }
}
