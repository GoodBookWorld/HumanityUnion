import type { InitiativePublicImpactLifecycleDraft } from "@hu/types";

export interface InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativePublicImpactLifecycleDraft>;
}

export interface InitiativePublicImpactLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativePublicImpactLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativePublicImpactLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot(): InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativePublicImpactLifecycleDrafts(
  drafts: Map<string, InitiativePublicImpactLifecycleDraft>,
): InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativePublicImpactLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
