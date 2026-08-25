import type { ClientSession } from "mongodb";

import type { SignatureStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { PetitionSignaturePersistenceError } from "../petition.errors.js";
import {
  fromPetitionSignatureMongoDocument,
  toPetitionSignatureMongoDocument,
  type PetitionSignatureMongoDocument,
  type PetitionSignatureMongoRecord,
} from "./petition-signature.mongo-document.js";

export function isDuplicateSignatureError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensurePetitionSignatureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new PetitionSignaturePersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PetitionSignatureMongoDocument>(MONGO_COLLECTIONS.petitionSignatures);
}

export async function insertPetitionSignatureDocument(
  record: PetitionSignatureMongoRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensurePetitionSignatureMongoReady();

  try {
    await collection().insertOne(toPetitionSignatureMongoDocument(record), {
      session: options.session,
    });
  } catch (error) {
    if (isDuplicateSignatureError(error)) {
      throw error;
    }

    throw new PetitionSignaturePersistenceError("Petition Signature insert failed.", error);
  }
}

export async function findSignatureByPetitionAndMember(
  petitionId: string,
  memberId: string,
): Promise<PetitionSignatureMongoRecord | null> {
  await ensurePetitionSignatureMongoReady();

  const document = await collection().findOne({ petitionId, memberId });

  return document ? fromPetitionSignatureMongoDocument(document) : null;
}

export async function listSignaturesByPetitionId(
  petitionId: string,
): Promise<PetitionSignatureMongoRecord[]> {
  await ensurePetitionSignatureMongoReady();

  const documents = await collection().find({ petitionId }).sort({ signedAt: 1 }).toArray();

  return documents.map((document) => fromPetitionSignatureMongoDocument(document));
}

/**
 * Bounded batched lookup used by list endpoints to avoid N+1 Signature
 * queries when reconstructing multiple Petition responses at once
 * (Recovery Task 24 Part 10).
 */
export async function listSignaturesByPetitionIds(
  petitionIds: string[],
): Promise<Map<string, PetitionSignatureMongoRecord[]>> {
  const grouped = new Map<string, PetitionSignatureMongoRecord[]>();

  if (petitionIds.length === 0) {
    return grouped;
  }

  await ensurePetitionSignatureMongoReady();

  const documents = await collection()
    .find({ petitionId: { $in: petitionIds } })
    .sort({ signedAt: 1 })
    .toArray();

  for (const document of documents) {
    const record = fromPetitionSignatureMongoDocument(document);
    const bucket = grouped.get(record.petitionId) ?? [];
    bucket.push(record);
    grouped.set(record.petitionId, bucket);
  }

  return grouped;
}

export async function countSignaturesByPetitionId(petitionId: string): Promise<number> {
  await ensurePetitionSignatureMongoReady();

  return collection().countDocuments({ petitionId });
}

/**
 * Pack 19C.2B — Participant Petition statistics.
 * Lists Signature rows for a Participant (`memberId` is the persistence field
 * for canonical Participant identity). Prefer Active-status filtering at the
 * caller for the public petition-signing metric.
 */
export async function listSignaturesByMemberId(
  memberId: string,
): Promise<PetitionSignatureMongoRecord[]> {
  const trimmed = memberId.trim();

  if (!trimmed) {
    return [];
  }

  if (!isMongoConfigured()) {
    return [];
  }

  await connectMongoClient();

  const documents = await collection().find({ memberId: trimmed }).toArray();

  return documents.map((document) => fromPetitionSignatureMongoDocument(document));
}

export async function listActiveSignaturesByMemberId(
  memberId: string,
): Promise<PetitionSignatureMongoRecord[]> {
  const trimmed = memberId.trim();

  if (!trimmed) {
    return [];
  }

  if (!isMongoConfigured()) {
    return [];
  }

  await connectMongoClient();

  const documents = await collection().find({ memberId: trimmed, status: "Active" }).toArray();

  return documents.map((document) => fromPetitionSignatureMongoDocument(document));
}

/**
 * Initiative Lifecycle — Part F, Section 8 (Withdraw Signature). Updates an
 * EXISTING Signature's `status` in place — the Signature document itself
 * (`signatureId`, `signedAt`) is never deleted or replaced, only its
 * `status` transitions between `"Active"`/`"Withdrawn"`, so the permanent
 * signing history stays intact. Re-signing after a Withdrawal reuses this
 * same function (flips back to `"Active"`, refreshes `signedAt`) rather
 * than inserting a second document, which would violate the
 * `unique(petitionId, memberId)` index.
 */
export async function updateSignatureStatus(
  petitionId: string,
  memberId: string,
  status: SignatureStatus,
  signedAt: string,
  options: { session?: ClientSession } = {},
): Promise<PetitionSignatureMongoRecord | null> {
  await ensurePetitionSignatureMongoReady();

  const document = await collection().findOneAndUpdate(
    { petitionId, memberId },
    { $set: { status, signedAt } },
    { returnDocument: "after", session: options.session },
  );

  return document ? fromPetitionSignatureMongoDocument(document) : null;
}

export async function deleteSignaturesByPetitionIdForTests(petitionId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ petitionId });

  return result.deletedCount ?? 0;
}

export async function deleteSignaturesByMemberIdForTests(memberId: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await collection().deleteMany({ memberId });

  return result.deletedCount ?? 0;
}
