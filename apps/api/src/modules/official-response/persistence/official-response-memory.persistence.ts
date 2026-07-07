import {
  createEmptyOfficialResponsePersistenceSnapshot,
  type OfficialResponsePersistenceAdapter,
} from "./official-response-persistence.types.js";

export class MemoryOfficialResponsePersistenceAdapter implements OfficialResponsePersistenceAdapter {
  readonly mode = "memory" as const;

  private snapshot = createEmptyOfficialResponsePersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryOfficialResponsePersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}
