import {
  createEmptyInitiativeDiscussionCompletionPersistenceSnapshot,
  type InitiativeDiscussionCompletionPersistenceAdapter,
  type InitiativeDiscussionCompletionPersistenceSnapshot,
} from "./initiative-discussion-completion-persistence.types.js";

export class MemoryInitiativeDiscussionCompletionPersistenceAdapter
  implements InitiativeDiscussionCompletionPersistenceAdapter
{
  readonly mode = "memory" as const;

  private snapshot = createEmptyInitiativeDiscussionCompletionPersistenceSnapshot();

  load(): InitiativeDiscussionCompletionPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeDiscussionCompletionPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeDiscussionCompletionPersistenceAdapter(): MemoryInitiativeDiscussionCompletionPersistenceAdapter {
  return new MemoryInitiativeDiscussionCompletionPersistenceAdapter();
}
