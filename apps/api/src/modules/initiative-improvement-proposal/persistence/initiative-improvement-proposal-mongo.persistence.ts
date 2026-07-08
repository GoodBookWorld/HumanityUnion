import type { InitiativeImprovementProposal } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeImprovementProposalPersistenceSnapshot,
  type InitiativeImprovementProposalPersistenceAdapter,
} from "./initiative-improvement-proposal-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeImprovementProposalPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImprovementProposals,
      idField: "proposalId",
      select: (snapshot) => snapshot.proposals as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        proposals: records as unknown as Record<string, InitiativeImprovementProposal>,
      }),
    },
  ],
});

export function createMongoInitiativeImprovementProposalPersistenceAdapter(): InitiativeImprovementProposalPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeImprovementProposalMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeImprovementProposalMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
