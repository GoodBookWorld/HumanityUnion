import type { InitiativeDiscussionCompletion } from "./persistence/initiative-discussion-completion-persistence.types.js";
import { resolveInitiativeDiscussionCompletionPersistenceAdapter } from "./persistence/resolve-initiative-discussion-completion-persistence.js";
import { snapshotFromInitiativeDiscussionCompletions } from "./persistence/initiative-discussion-completion-persistence.types.js";

const persistence = resolveInitiativeDiscussionCompletionPersistenceAdapter();

function loadCompletionsMap(): Map<string, InitiativeDiscussionCompletion> {
  const snapshot = persistence.load();
  return new Map(
    Object.entries(snapshot.completions).map(([initiativeId, completion]) => [
      initiativeId,
      structuredClone(completion),
    ]),
  );
}

function persistCompletionsMap(completions: Map<string, InitiativeDiscussionCompletion>): void {
  persistence.save(snapshotFromInitiativeDiscussionCompletions(completions));
}

const completions = loadCompletionsMap();

export function getDiscussionCompletionByInitiativeId(
  initiativeId: string,
): InitiativeDiscussionCompletion | null {
  const completion = completions.get(initiativeId);
  return completion ? structuredClone(completion) : null;
}

/**
 * Idempotent upsert — reopening/completing again returns the same completion.
 * Does not publish and does not advance lifecycle by itself.
 */
export function upsertDiscussionCompletion(
  completion: InitiativeDiscussionCompletion,
): InitiativeDiscussionCompletion {
  const existing = completions.get(completion.initiativeId);
  if (existing) {
    return structuredClone(existing);
  }

  completions.set(completion.initiativeId, structuredClone(completion));
  persistCompletionsMap(completions);
  return structuredClone(completion);
}

/** Test-only reset. */
export function clearDiscussionCompletionsForTests(): void {
  completions.clear();
  persistCompletionsMap(completions);
}
