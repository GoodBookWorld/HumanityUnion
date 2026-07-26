import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { DecisionPersistenceError } from "../domain/decision.errors.js";
import type { DecisionRecord } from "../domain/decision.types.js";
import {
  fromDecisionMongoDocument,
  toDecisionMongoDocument,
  type DecisionMongoDocument,
} from "./decision.persistence.js";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureDecisionMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new DecisionPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

export async function insertDecision(
  record: DecisionRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensureDecisionMongoReady();

  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);

  try {
    await collection.insertOne(toDecisionMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DecisionPersistenceError("Decision identifier conflict.", error);
    }

    throw new DecisionPersistenceError("Decision persistence failed.", error);
  }
}

export async function findDecisionById(decisionId: string): Promise<DecisionRecord | null> {
  await ensureDecisionMongoReady();

  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);
  const document = await collection.findOne({ decisionId });

  return document ? fromDecisionMongoDocument(document) : null;
}

export async function findDecisionByProposalId(proposalId: string): Promise<DecisionRecord | null> {
  await ensureDecisionMongoReady();

  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);
  const document = await collection.findOne({ proposalId });

  return document ? fromDecisionMongoDocument(document) : null;
}

export async function countDecisions(filter: {
  decisionId?: string;
  proposalId?: string;
  activityId?: string;
  creatorMemberId?: string;
} = {}): Promise<number> {
  await ensureDecisionMongoReady();

  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);
  const query: Record<string, string> = {};

  if (filter.decisionId) {
    query.decisionId = filter.decisionId;
  }

  if (filter.proposalId) {
    query.proposalId = filter.proposalId;
  }

  if (filter.activityId) {
    query.activityId = filter.activityId;
  }

  if (filter.creatorMemberId) {
    query.creatorMemberId = filter.creatorMemberId;
  }

  return collection.countDocuments(query);
}

export async function deleteDecisionsByDecisionIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);
  const result = await collection.deleteMany({ decisionId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteDecisionsByCreatorMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<DecisionMongoDocument>(MONGO_COLLECTIONS.decisions);
  const result = await collection.deleteMany({ creatorMemberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}
