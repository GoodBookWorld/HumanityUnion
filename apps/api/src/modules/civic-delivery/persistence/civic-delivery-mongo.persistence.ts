import type { CivicActionPackageDelivery, CivicDeliveryRecipient } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicDeliveryPersistenceSnapshot,
  type CivicDeliveryPersistenceAdapter,
} from "./civic-delivery-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicDeliveryPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicDeliveries,
      idField: "deliveryId",
      select: (snapshot) => snapshot.deliveries as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        deliveries: records as unknown as Record<string, CivicActionPackageDelivery>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.civicDeliveryRecipients,
      idField: "recipientId",
      select: (snapshot) => snapshot.recipients as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        recipients: records as unknown as Record<string, CivicDeliveryRecipient>,
      }),
    },
  ],
});

export function createMongoCivicDeliveryPersistenceAdapter(): CivicDeliveryPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicDeliveryMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_DELIVERY_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicDeliveryMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_DELIVERY_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
