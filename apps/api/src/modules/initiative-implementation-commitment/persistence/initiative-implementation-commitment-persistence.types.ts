import type { InitiativeImplementationCommitment } from "@hu/types";

export interface InitiativeImplementationCommitmentPersistenceSnapshot {
  version: 1;
  commitments: Record<string, InitiativeImplementationCommitment>;
}

export interface InitiativeImplementationCommitmentPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeImplementationCommitmentPersistenceSnapshot;
  save(snapshot: InitiativeImplementationCommitmentPersistenceSnapshot): void;
}

export function createEmptyInitiativeImplementationCommitmentPersistenceSnapshot(): InitiativeImplementationCommitmentPersistenceSnapshot {
  return {
    version: 1,
    commitments: {},
  };
}

export function snapshotFromCommitments(
  commitments: Map<string, InitiativeImplementationCommitment>,
): InitiativeImplementationCommitmentPersistenceSnapshot {
  const record: Record<string, InitiativeImplementationCommitment> = {};

  for (const [commitmentId, commitment] of commitments) {
    record[commitmentId] = structuredClone(commitment);
  }

  return {
    version: 1,
    commitments: record,
  };
}
