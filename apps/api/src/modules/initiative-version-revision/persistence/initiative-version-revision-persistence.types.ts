import type { InitiativeRevisionDraft, InitiativeVersionRevision } from "@hu/types";

export interface InitiativeVersionRevisionPersistenceSnapshot {
  version: 1;
  revisions: Record<string, InitiativeVersionRevision>;
  drafts: Record<string, InitiativeRevisionDraft>;
}

export interface InitiativeVersionRevisionPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeVersionRevisionPersistenceSnapshot;
  save(snapshot: InitiativeVersionRevisionPersistenceSnapshot): void;
}

export function createEmptyInitiativeVersionRevisionPersistenceSnapshot(): InitiativeVersionRevisionPersistenceSnapshot {
  return {
    version: 1,
    revisions: {},
    drafts: {},
  };
}

export function snapshotFromRevisionStore(
  revisions: Map<string, InitiativeVersionRevision>,
  drafts: Map<string, InitiativeRevisionDraft>,
): InitiativeVersionRevisionPersistenceSnapshot {
  const revisionRecord: Record<string, InitiativeVersionRevision> = {};
  const draftRecord: Record<string, InitiativeRevisionDraft> = {};

  for (const [revisionId, revision] of revisions) {
    revisionRecord[revisionId] = structuredClone(revision);
  }

  for (const [initiativeId, draft] of drafts) {
    draftRecord[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    revisions: revisionRecord,
    drafts: draftRecord,
  };
}
