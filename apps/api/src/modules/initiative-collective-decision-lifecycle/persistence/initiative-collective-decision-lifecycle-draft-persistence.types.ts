import type { InitiativeCollectiveDecisionLifecycleDraft } from "@hu/types";

export interface InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeCollectiveDecisionLifecycleDraft>;
}

export interface InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot(): InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeCollectiveDecisionLifecycleDrafts(
  drafts: Map<string, InitiativeCollectiveDecisionLifecycleDraft>,
): InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativeCollectiveDecisionLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
