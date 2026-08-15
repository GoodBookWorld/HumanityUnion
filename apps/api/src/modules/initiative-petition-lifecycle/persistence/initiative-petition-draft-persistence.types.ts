import type { InitiativePetitionDraft } from "@hu/types";

export interface InitiativePetitionDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativePetitionDraft>;
}

export interface InitiativePetitionDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativePetitionDraftPersistenceSnapshot;
  save(snapshot: InitiativePetitionDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativePetitionDraftPersistenceSnapshot(): InitiativePetitionDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativePetitionDrafts(
  drafts: Map<string, InitiativePetitionDraft>,
): InitiativePetitionDraftPersistenceSnapshot {
  const record: Record<string, InitiativePetitionDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
