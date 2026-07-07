import { MemoryOfficialResponsePersistenceAdapter } from "./official-response-memory.persistence.js";
import { FileOfficialResponsePersistenceAdapter } from "./official-response-file.persistence.js";
import type { OfficialResponsePersistenceAdapter } from "./official-response-persistence.types.js";

export function resolveOfficialResponsePersistenceAdapter(): OfficialResponsePersistenceAdapter {
  const mode = process.env.OFFICIAL_RESPONSE_PERSISTENCE ?? "file";

  if (mode === "memory") {
    return new MemoryOfficialResponsePersistenceAdapter();
  }

  const filePath = process.env.OFFICIAL_RESPONSE_PERSISTENCE_PATH;

  return filePath
    ? new FileOfficialResponsePersistenceAdapter(filePath)
    : new FileOfficialResponsePersistenceAdapter();
}
