import type { InitiativeImplementationCommitment } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeImplementationCommitmentPersistenceSnapshot,
  type InitiativeImplementationCommitmentPersistenceAdapter,
} from "./initiative-implementation-commitment-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeImplementationCommitmentPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImplementationCommitments,
      idField: "commitmentId",
      select: (snapshot) => snapshot.commitments as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        commitments: records as unknown as Record<string, InitiativeImplementationCommitment>,
      }),
    },
  ],
});

export function createMongoInitiativeImplementationCommitmentPersistenceAdapter(): InitiativeImplementationCommitmentPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeImplementationCommitmentMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeImplementationCommitmentMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
