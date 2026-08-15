import type { InitiativeImplementationCommitmentLifecycleDraft } from "@hu/types";

export interface InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeImplementationCommitmentLifecycleDraft>;
}

export interface InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot(): InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeImplementationCommitmentLifecycleDrafts(
  drafts: Map<string, InitiativeImplementationCommitmentLifecycleDraft>,
): InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativeImplementationCommitmentLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
