import type { InitiativePublicImpact, PublicImpactEvidence } from "@hu/types";

export interface InitiativePublicImpactPersistenceSnapshot {
  version: 1;
  impacts: Record<string, InitiativePublicImpact>;
  evidence: Record<string, PublicImpactEvidence>;
}

export interface InitiativePublicImpactPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativePublicImpactPersistenceSnapshot;
  save(snapshot: InitiativePublicImpactPersistenceSnapshot): void;
}

export function createEmptyInitiativePublicImpactPersistenceSnapshot(): InitiativePublicImpactPersistenceSnapshot {
  return {
    version: 1,
    impacts: {},
    evidence: {},
  };
}

export function snapshotFromPublicImpactData(input: {
  impacts: Map<string, InitiativePublicImpact>;
  evidence: Map<string, PublicImpactEvidence>;
}): InitiativePublicImpactPersistenceSnapshot {
  const impacts: Record<string, InitiativePublicImpact> = {};
  const evidence: Record<string, PublicImpactEvidence> = {};

  for (const [impactId, impact] of input.impacts) {
    impacts[impactId] = structuredClone(impact);
  }

  for (const [evidenceId, item] of input.evidence) {
    evidence[evidenceId] = structuredClone(item);
  }

  return {
    version: 1,
    impacts,
    evidence,
  };
}
