import type { InitiativeDiscussionCompletionPersistenceAdapter } from "./initiative-discussion-completion-persistence.types.js";
import { createFileInitiativeDiscussionCompletionPersistenceAdapter } from "./initiative-discussion-completion-file.persistence.js";
import { createMemoryInitiativeDiscussionCompletionPersistenceAdapter } from "./initiative-discussion-completion-memory.persistence.js";
import { createMongoInitiativeDiscussionCompletionPersistenceAdapter } from "./initiative-discussion-completion-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";

export function resolveInitiativeDiscussionCompletionPersistenceAdapter(): InitiativeDiscussionCompletionPersistenceAdapter {
  const mode = resolvePersistenceMode(
    "INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE",
    "file",
  );

  switch (mode) {
    case "memory":
      return createMemoryInitiativeDiscussionCompletionPersistenceAdapter();
    case "mongodb":
      return createMongoInitiativeDiscussionCompletionPersistenceAdapter();
    case "file":
    default:
      return createFileInitiativeDiscussionCompletionPersistenceAdapter();
  }
}
