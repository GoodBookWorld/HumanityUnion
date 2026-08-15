import type { InitiativeImprovementProposalsCollection } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { InitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage.types.js";

interface InitiativeImprovementProposalsCollectionDocument extends InitiativeImprovementProposalsCollection {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is required for Improvement Proposals stage persistence.");
  }

  await connectMongoClient();
}

function stripDocument(
  document: InitiativeImprovementProposalsCollectionDocument,
): InitiativeImprovementProposalsCollection {
  const { _id: _ignored, ...record } = document;
  return record;
}

export class MongoInitiativeImprovementProposalsStagePersistenceAdapter
  implements InitiativeImprovementProposalsStagePersistenceAdapter
{
  readonly mode = "mongodb" as const;

  async findById(collectionId: string): Promise<InitiativeImprovementProposalsCollection | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    const document = await collection.findOne({ collectionId });

    return document ? stripDocument(document) : null;
  }

  async listByInitiativeAndAuthor(
    initiativeId: string,
    authorId: string,
  ): Promise<InitiativeImprovementProposalsCollection[]> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    const documents = await collection.find({ initiativeId, authorId }).toArray();

    return documents.map(stripDocument);
  }

  async listByInitiative(initiativeId: string): Promise<InitiativeImprovementProposalsCollection[]> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    const documents = await collection.find({ initiativeId }).toArray();

    return documents.map(stripDocument);
  }

  async insert(record: InitiativeImprovementProposalsCollection): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    await collection.insertOne(record);
  }

  async update(record: InitiativeImprovementProposalsCollection): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    await collection.updateOne({ collectionId: record.collectionId }, { $set: record });
  }

  async deleteByAuthorIdForTests(authorId: string): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    const result = await collection.deleteMany({ authorId });

    return result.deletedCount ?? 0;
  }
}

export function createMongoInitiativeImprovementProposalsStagePersistenceAdapter(): MongoInitiativeImprovementProposalsStagePersistenceAdapter {
  return new MongoInitiativeImprovementProposalsStagePersistenceAdapter();
}

export async function ensureInitiativeImprovementProposalsStageMongoIndexes(): Promise<void> {
  if (!isMongoConfigured() || !isMongoPersistenceMode("INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE")) {
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
    MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
  );

  await collection.createIndex({ collectionId: 1 }, { unique: true });
  await collection.createIndex({ initiativeId: 1, authorId: 1 });
  await collection.createIndex({ initiativeId: 1, status: 1 });
}
