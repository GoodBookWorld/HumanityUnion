import type { ParticipationArea, ParticipationAreaTransition } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyParticipationAreaPersistenceSnapshot,
  type ParticipationAreaPersistenceAdapter,
} from "./participation-area-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyParticipationAreaPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.participationAreas,
      idField: "participationAreaId",
      select: (snapshot) => snapshot.areas as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        areas: records as unknown as Record<string, ParticipationArea>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.participationAreaTransitions,
      idField: "transitionId",
      select: (snapshot) => snapshot.transitions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        transitions: records as unknown as Record<string, ParticipationAreaTransition>,
      }),
    },
  ],
});

export function createMongoParticipationAreaPersistenceAdapter(): ParticipationAreaPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateParticipationAreaMongoPersistence(): Promise<void> {
  if (process.env.PARTICIPATION_AREA_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushParticipationAreaMongoPersistence(): Promise<void> {
  if (process.env.PARTICIPATION_AREA_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
