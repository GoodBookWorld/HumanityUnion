import type { InitiativeCivicArchiveLifecycleDraft } from "@hu/types";

export interface InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeCivicArchiveLifecycleDraft>;
}

export interface InitiativeCivicArchiveLifecycleDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot;
  save(snapshot: InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot(): InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeCivicArchiveLifecycleDrafts(
  drafts: Map<string, InitiativeCivicArchiveLifecycleDraft>,
): InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
  const record: Record<string, InitiativeCivicArchiveLifecycleDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
