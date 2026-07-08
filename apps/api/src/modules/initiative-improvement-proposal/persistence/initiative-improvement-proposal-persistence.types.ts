import type { InitiativeImprovementProposal } from "@hu/types";

export interface InitiativeImprovementProposalPersistenceSnapshot {
  version: 1;
  proposals: Record<string, InitiativeImprovementProposal>;
}

export interface InitiativeImprovementProposalPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeImprovementProposalPersistenceSnapshot;
  save(snapshot: InitiativeImprovementProposalPersistenceSnapshot): void;
}

export function createEmptyInitiativeImprovementProposalPersistenceSnapshot(): InitiativeImprovementProposalPersistenceSnapshot {
  return {
    version: 1,
    proposals: {},
  };
}

export function snapshotFromProposals(
  proposals: Map<string, InitiativeImprovementProposal>,
): InitiativeImprovementProposalPersistenceSnapshot {
  const record: Record<string, InitiativeImprovementProposal> = {};

  for (const [proposalId, proposal] of proposals) {
    record[proposalId] = structuredClone(proposal);
  }

  return {
    version: 1,
    proposals: record,
  };
}
