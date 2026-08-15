import type { InitiativeOfficialResponseLifecycleDraft } from "@hu/types";

export interface InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeOfficialResponseLifecycleDraft>;
}

export interface InitiativeOfficialResponseLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot(): InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeOfficialResponseLifecycleDrafts(
  drafts: Map<string, InitiativeOfficialResponseLifecycleDraft>,
): InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativeOfficialResponseLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
