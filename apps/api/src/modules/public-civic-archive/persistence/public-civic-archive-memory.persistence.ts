import { createEmptyPublicCivicArchivePersistenceSnapshot } from "./public-civic-archive-persistence.types.js";

export function createMemoryPublicCivicArchivePersistenceAdapter() {
  let snapshot = createEmptyPublicCivicArchivePersistenceSnapshot();

  return {
    mode: "memory" as const,
    load() {
      return structuredClone(snapshot);
    },
    save(nextSnapshot: typeof snapshot) {
      snapshot = structuredClone(nextSnapshot);
    },
  };
}
