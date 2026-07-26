import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { ProposalPersistenceError } from "../domain/proposal.errors.js";
import type { ProposalRecord } from "../domain/proposal.types.js";
import {
  fromProposalMongoDocument,
  toProposalMongoDocument,
  type ProposalMongoDocument,
} from "./proposal.persistence.js";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureProposalMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new ProposalPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

export async function insertProposal(
  record: ProposalRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensureProposalMongoReady();

  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);

  try {
    await collection.insertOne(toProposalMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ProposalPersistenceError("Proposal identifier conflict.", error);
    }

    throw new ProposalPersistenceError("Proposal persistence failed.", error);
  }
}

export async function findProposalById(proposalId: string): Promise<ProposalRecord | null> {
  await ensureProposalMongoReady();

  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);
  const document = await collection.findOne({ proposalId });

  return document ? fromProposalMongoDocument(document) : null;
}

export type ProposalSubmissionUpdateOutcome = "updated" | "conflict";

export async function updateProposalForSubmission(
  record: ProposalRecord,
  expected: {
    aggregateVersion: number;
    status: ProposalRecord["status"];
  },
  options: { session?: ClientSession } = {},
): Promise<ProposalSubmissionUpdateOutcome> {
  await ensureProposalMongoReady();

  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);
  const updateResult = await collection.updateOne(
    {
      proposalId: record.proposalId,
      aggregateVersion: expected.aggregateVersion,
      status: expected.status,
    },
    {
      $set: {
        status: record.status,
        aggregateVersion: record.aggregateVersion,
        updatedAt: record.updatedAt,
      },
    },
    { session: options.session },
  );

  return (updateResult.modifiedCount ?? 0) > 0 ? "updated" : "conflict";
}

export async function countProposals(filter: {
  proposalId?: string;
  activityId?: string;
  discussionId?: string;
  creatorMemberId?: string;
} = {}): Promise<number> {
  await ensureProposalMongoReady();

  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);
  const query: Record<string, string> = {};

  if (filter.proposalId) {
    query.proposalId = filter.proposalId;
  }

  if (filter.activityId) {
    query.activityId = filter.activityId;
  }

  if (filter.discussionId) {
    query.discussionId = filter.discussionId;
  }

  if (filter.creatorMemberId) {
    query.creatorMemberId = filter.creatorMemberId;
  }

  return collection.countDocuments(query);
}

export async function deleteProposalsByProposalIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);
  const result = await collection.deleteMany({ proposalId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteProposalsByCreatorMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<ProposalMongoDocument>(MONGO_COLLECTIONS.proposals);
  const result = await collection.deleteMany({ creatorMemberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}
