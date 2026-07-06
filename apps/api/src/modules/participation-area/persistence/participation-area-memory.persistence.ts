import {
  createEmptyParticipationAreaPersistenceSnapshot,
  type ParticipationAreaPersistenceAdapter,
  type ParticipationAreaPersistenceSnapshot,
} from "./participation-area-persistence.types.js";

export class MemoryParticipationAreaPersistenceAdapter implements ParticipationAreaPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: ParticipationAreaPersistenceSnapshot =
    createEmptyParticipationAreaPersistenceSnapshot();

  load(): ParticipationAreaPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ParticipationAreaPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryParticipationAreaPersistenceAdapter(): MemoryParticipationAreaPersistenceAdapter {
  return new MemoryParticipationAreaPersistenceAdapter();
}
