import type { InitiativeDecisionSessionDraft } from "@hu/types";

export interface InitiativeDecisionSessionDraftPersistenceSnapshot {
  version: 1;
  drafts: Record<string, InitiativeDecisionSessionDraft>;
}

export interface InitiativeDecisionSessionDraftPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeDecisionSessionDraftPersistenceSnapshot;
  save(snapshot: InitiativeDecisionSessionDraftPersistenceSnapshot): void;
}

export function createEmptyInitiativeDecisionSessionDraftPersistenceSnapshot(): InitiativeDecisionSessionDraftPersistenceSnapshot {
  return {
    version: 1,
    drafts: {},
  };
}

export function snapshotFromInitiativeDecisionSessionDrafts(
  drafts: Map<string, InitiativeDecisionSessionDraft>,
): InitiativeDecisionSessionDraftPersistenceSnapshot {
  const record: Record<string, InitiativeDecisionSessionDraft> = {};

  for (const [initiativeId, draft] of drafts) {
    record[initiativeId] = structuredClone(draft);
  }

  return {
    version: 1,
    drafts: record,
  };
}
