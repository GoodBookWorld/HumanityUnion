import type { InitiativeCollectiveDecision } from "@hu/types";

export interface InitiativeCollectiveDecisionPersistenceSnapshot {
  version: 1;
  decisions: Record<string, InitiativeCollectiveDecision>;
}

export interface InitiativeCollectiveDecisionPersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): InitiativeCollectiveDecisionPersistenceSnapshot;
  save(snapshot: InitiativeCollectiveDecisionPersistenceSnapshot): void;
}

export function createEmptyInitiativeCollectiveDecisionPersistenceSnapshot(): InitiativeCollectiveDecisionPersistenceSnapshot {
  return {
    version: 1,
    decisions: {},
  };
}

export function snapshotFromDecisions(
  decisions: Map<string, InitiativeCollectiveDecision>,
): InitiativeCollectiveDecisionPersistenceSnapshot {
  const record: Record<string, InitiativeCollectiveDecision> = {};

  for (const [decisionId, decision] of decisions) {
    record[decisionId] = structuredClone(decision);
  }

  return {
    version: 1,
    decisions: record,
  };
}
