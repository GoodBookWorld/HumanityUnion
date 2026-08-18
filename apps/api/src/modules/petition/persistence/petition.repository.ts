import type { ClientSession } from "mongodb";

import type { PetitionState } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { PetitionPersistenceError } from "../petition.errors.js";
import {
  fromPetitionMongoDocument,
  toPetitionMongoDocument,
  type PetitionMongoDocument,
  type PetitionMongoRecord,
} from "./petition.mongo-document.js";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensurePetitionMongoReady(): Promise<void> {
  // Author Lifecycle treats Petition as SOURCE_OPTIONAL. Unit certification
  // must not hang on Mongo selection when Petition substrate is unavailable.
  if (process.env.NODE_TEST_ENV === "true") {
    throw new PetitionPersistenceError("MongoDB skipped in NODE_TEST_ENV.");
  }

  if (!isMongoConfigured()) {
    throw new PetitionPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PetitionMongoDocument>(MONGO_COLLECTIONS.petitions);
}

export async function insertPetitionDocument(
  record: PetitionMongoRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensurePetitionMongoReady();

  try {
    await collection().insertOne(toPetitionMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new PetitionPersistenceError(`Petition "${record.petitionId}" already exists.`, error);
    }

    throw new PetitionPersistenceError("Petition insert failed.", error);
  }
}

export async function findPetitionById(petitionId: string): Promise<PetitionMongoRecord | null> {
  await ensurePetitionMongoReady();

  const document = await collection().findOne({ petitionId });

  return document ? fromPetitionMongoDocument(document) : null;
}

export async function findPetitionByCollectiveDecisionId(
  collectiveDecisionId: string,
): Promise<PetitionMongoRecord | null> {
  await ensurePetitionMongoReady();

  const document = await collection().findOne({ collectiveDecisionId });

  return document ? fromPetitionMongoDocument(document) : null;
}

export async function findPetitionByInitiativeId(
  initiativeId: string,
): Promise<PetitionMongoRecord | null> {
  await ensurePetitionMongoReady();

  const document = await collection().findOne({ "subject.initiativeId": initiativeId });

  return document ? fromPetitionMongoDocument(document) : null;
}

export async function listPetitionDocuments(): Promise<PetitionMongoRecord[]> {
  await ensurePetitionMongoReady();

  const documents = await collection().find({}).toArray();

  return documents.map((document) => fromPetitionMongoDocument(document));
}

export async function countPetitionsByCollectiveDecisionId(
  collectiveDecisionId: string,
  excludePetitionId?: string,
): Promise<number> {
  await ensurePetitionMongoReady();

  const query: Record<string, unknown> = { collectiveDecisionId };

  if (excludePetitionId) {
    query.petitionId = { $ne: excludePetitionId };
  }

  return collection().countDocuments(query);
}

/**
 * Applies a conditional lifecycle/subject/policy patch guarded by the status
 * observed at read time, preventing stale concurrent lifecycle writes
 * (Recovery Task 24 Part 11) without introducing a dedicated version field.
 * Returns the updated record, or `null` if the guard did not match (the
 * Petition either no longer exists or was concurrently modified).
 */
export async function updatePetitionConditionally(
  petitionId: string,
  expectedStatus: PetitionState,
  patch: Partial<
    Pick<
      PetitionMongoRecord,
      "status" | "subject" | "policy" | "shareLink" | "updatedAt" | "traceability"
    >
  >,
  options: { session?: ClientSession } = {},
): Promise<PetitionMongoRecord | null> {
  await ensurePetitionMongoReady();

  const document = await collection().findOneAndUpdate(
    { petitionId, status: expectedStatus },
    { $set: patch },
    { returnDocument: "after", session: options.session },
  );

  return document ? fromPetitionMongoDocument(document) : null;
}

export async function deletePetitionsByIdForTests(petitionId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ petitionId });

  return result.deletedCount ?? 0;
}

export async function deletePetitionsByInitiativeIdForTests(initiativeId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ "subject.initiativeId": initiativeId });

  return result.deletedCount ?? 0;
}
