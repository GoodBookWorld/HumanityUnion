export interface InitiativeDiscussionCompletion {
  readonly completionId: string;
  readonly initiativeId: string;
  readonly completedByParticipantId: string;
  readonly completedAt: string;
}

export interface InitiativeDiscussionCompletionPersistenceSnapshot {
  version: 1;
  completions: Record<string, InitiativeDiscussionCompletion>;
}

export interface InitiativeDiscussionCompletionPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeDiscussionCompletionPersistenceSnapshot;
  save(snapshot: InitiativeDiscussionCompletionPersistenceSnapshot): void;
}

export function createEmptyInitiativeDiscussionCompletionPersistenceSnapshot(): InitiativeDiscussionCompletionPersistenceSnapshot {
  return {
    version: 1,
    completions: {},
  };
}

export function snapshotFromInitiativeDiscussionCompletions(
  completions: Map<string, InitiativeDiscussionCompletion>,
): InitiativeDiscussionCompletionPersistenceSnapshot {
  const record: Record<string, InitiativeDiscussionCompletion> = {};

  for (const [initiativeId, completion] of completions) {
    record[initiativeId] = structuredClone(completion);
  }

  return {
    version: 1,
    completions: record,
  };
}
