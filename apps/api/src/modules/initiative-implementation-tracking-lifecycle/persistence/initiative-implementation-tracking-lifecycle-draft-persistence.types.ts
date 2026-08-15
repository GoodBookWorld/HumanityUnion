import type { InitiativeImplementationTrackingLifecycleDraft } from "@hu/types";

export interface InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeImplementationTrackingLifecycleDraft>;
}

export interface InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot(): InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeImplementationTrackingLifecycleDrafts(
  drafts: Map<string, InitiativeImplementationTrackingLifecycleDraft>,
): InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativeImplementationTrackingLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
