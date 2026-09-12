import type { InitiativeImprovementProposalsCollection } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { extractPublicImprovementProposalIds } from "../extract-public-improvement-proposal-ids.js";
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

  async findPublishedProposalById(
    proposalId: string,
  ): Promise<{
    readonly collection: InitiativeImprovementProposalsCollection;
    readonly proposal: InitiativeImprovementProposalsCollection["proposals"][number];
  } | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    const document = await collection.findOne({
      status: "published",
      "proposals.proposalId": proposalId,
    });
    if (!document) {
      return null;
    }
    const record = stripDocument(document);
    const proposal = record.proposals.find((row) => row.proposalId === proposalId);
    if (
      !proposal ||
      (proposal.status !== "published" &&
        proposal.status !== "included_in_revision" &&
        proposal.status !== "keep_for_later" &&
        proposal.status !== "not_applicable")
    ) {
      return null;
    }
    return { collection: record, proposal };
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

  async listPublishedProposalIdsPage(input: {
    readonly limit: number;
    readonly offset: number;
  }): Promise<{
    readonly proposalIds: readonly string[];
    readonly collectionsReturned: number;
    readonly hasMore: boolean;
  }> {
    await ensureMongoReady();
    const limit = Math.max(1, Math.floor(input.limit));
    const offset = Math.max(0, Math.floor(input.offset));
    const collection = getMongoCollection<InitiativeImprovementProposalsCollectionDocument>(
      MONGO_COLLECTIONS.initiativeImprovementProposalsCollections,
    );
    // Lean projection: proposalId + status only (no title/summary/description bodies).
    const documents = await collection
      .find(
        { status: "published" },
        {
          projection: {
            _id: 0,
            "proposals.proposalId": 1,
            "proposals.status": 1,
          },
        },
      )
      .sort({ collectionId: 1 })
      .skip(offset)
      .limit(limit + 1)
      .toArray();

    const hasMore = documents.length > limit;
    const page = hasMore ? documents.slice(0, limit) : documents;
    const proposalIds: string[] = [];
    for (const document of page) {
      const proposals = Array.isArray(document.proposals) ? document.proposals : [];
      proposalIds.push(...extractPublicImprovementProposalIds(proposals));
    }
    return {
      proposalIds,
      collectionsReturned: page.length,
      hasMore,
    };
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
