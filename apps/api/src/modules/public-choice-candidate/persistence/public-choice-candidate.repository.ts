import { randomUUID } from "node:crypto";

import type { PublicChoiceCandidate } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  fromPublicChoiceCandidateMongoDocument,
  toPublicChoiceCandidateMongoDocument,
  type PublicChoiceCandidateMongoDocument,
} from "./public-choice-candidate.mongo-document.js";
import {
  deletePublicChoiceCandidate as deleteMemoryCandidate,
  getPublicChoiceCandidateById as getMemoryCandidate,
  insertPublicChoiceCandidate as insertMemoryCandidate,
  listPublicChoiceCandidatesByInitiative as listMemoryCandidates,
  updatePublicChoiceCandidate as updateMemoryCandidate,
} from "../public-choice-candidate.memory.store.js";

async function ensureCandidateMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PublicChoiceCandidateMongoDocument>(
    MONGO_COLLECTIONS.publicChoiceCandidates,
  );
}

function shouldUseMemoryCandidateAdapter(): boolean {
  return !isMongoConfigured();
}

export function createPublicChoiceCandidateId(): string {
  return `pc-candidate-${randomUUID()}`;
}

export async function listPublicChoiceCandidatesByInitiative(
  initiativeId: string,
): Promise<PublicChoiceCandidate[]> {
  if (shouldUseMemoryCandidateAdapter()) {
    return listMemoryCandidates(initiativeId);
  }

  await ensureCandidateMongoReady();
  const documents = await collection()
    .find({ initiativeId })
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();
  return documents.map(fromPublicChoiceCandidateMongoDocument);
}

export async function getPublicChoiceCandidateById(
  candidateId: string,
): Promise<PublicChoiceCandidate | null> {
  if (shouldUseMemoryCandidateAdapter()) {
    return getMemoryCandidate(candidateId);
  }

  await ensureCandidateMongoReady();
  const document = await collection().findOne({ candidateId });
  return document ? fromPublicChoiceCandidateMongoDocument(document) : null;
}

export async function insertPublicChoiceCandidate(
  candidate: PublicChoiceCandidate,
): Promise<PublicChoiceCandidate> {
  if (shouldUseMemoryCandidateAdapter()) {
    return insertMemoryCandidate(candidate);
  }

  await ensureCandidateMongoReady();
  await collection().insertOne(toPublicChoiceCandidateMongoDocument(candidate));
  return candidate;
}

export async function updatePublicChoiceCandidate(
  candidate: PublicChoiceCandidate,
): Promise<PublicChoiceCandidate> {
  if (shouldUseMemoryCandidateAdapter()) {
    return updateMemoryCandidate(candidate);
  }

  await ensureCandidateMongoReady();
  await collection().replaceOne(
    { candidateId: candidate.candidateId },
    toPublicChoiceCandidateMongoDocument(candidate),
  );
  return candidate;
}

export async function deletePublicChoiceCandidate(candidateId: string): Promise<boolean> {
  if (shouldUseMemoryCandidateAdapter()) {
    return deleteMemoryCandidate(candidateId);
  }

  await ensureCandidateMongoReady();
  const result = await collection().deleteOne({ candidateId });
  return result.deletedCount === 1;
}

/** Test-only cleanup — deletes all candidates for an initiative. */
export async function deletePublicChoiceCandidatesByInitiativeForTests(
  initiativeId: string,
): Promise<void> {
  if (shouldUseMemoryCandidateAdapter()) {
    const existing = listMemoryCandidates(initiativeId);
    for (const candidate of existing) {
      deleteMemoryCandidate(candidate.candidateId);
    }
    return;
  }

  await ensureCandidateMongoReady();
  await collection().deleteMany({ initiativeId });
}

/** Pack 02C — stamp retention expiry on Candidate documents (never deletes media files). */
export async function stampPublicChoiceCandidateExpireAtForInitiative(
  initiativeId: string,
  expireAt: string,
): Promise<void> {
  if (shouldUseMemoryCandidateAdapter()) {
    return;
  }

  await ensureCandidateMongoReady();
  await collection().updateMany({ initiativeId }, { $set: { expireAt } });
}
