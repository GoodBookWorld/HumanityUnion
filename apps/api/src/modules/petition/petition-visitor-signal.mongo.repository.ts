import { randomUUID } from "node:crypto";

import type { PetitionVisitorSignalRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

interface PetitionVisitorSignalDocument extends PetitionVisitorSignalRecord {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for petition visitor signals.");
  }

  await connectMongoClient();
}

export async function recordPetitionVisitorSignalMongo(input: {
  petitionId: string;
  visitorKey: string;
}): Promise<PetitionVisitorSignalRecord> {
  await ensureMongoReady();

  const collection = getMongoCollection<PetitionVisitorSignalDocument>(
    MONGO_COLLECTIONS.petitionVisitorSignals,
  );
  const existing = await collection.findOne({
    petitionId: input.petitionId,
    visitorKey: input.visitorKey,
  });

  if (existing) {
    return {
      signalId: existing.signalId,
      petitionId: existing.petitionId,
      visitorKey: existing.visitorKey,
      createdAt: existing.createdAt,
    };
  }

  const record: PetitionVisitorSignalRecord = {
    signalId: randomUUID(),
    petitionId: input.petitionId,
    visitorKey: input.visitorKey,
    createdAt: new Date().toISOString(),
  };

  await collection.updateOne(
    { petitionId: input.petitionId, visitorKey: input.visitorKey },
    { $setOnInsert: record },
    { upsert: true },
  );

  return record;
}

export async function countPetitionVisitorSignalsMongo(petitionId: string): Promise<number> {
  await ensureMongoReady();

  const collection = getMongoCollection<PetitionVisitorSignalDocument>(
    MONGO_COLLECTIONS.petitionVisitorSignals,
  );

  return collection.countDocuments({ petitionId });
}
