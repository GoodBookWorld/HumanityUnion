import { isExplicitIsolatedMongoTest } from "../../infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type {
  PetitionWorkingDraft,
  PetitionWorkingDraftContentUpdate,
} from "./petition-working-draft.types.js";

/** Petition persistence is MongoDB-only; tests use an explicitly isolated hu_test_ database. */
async function ensureReady(): Promise<void> {
  if (process.env.NODE_TEST_ENV === "true" && !isExplicitIsolatedMongoTest()) {
    throw new Error("Petition draft storage is unavailable: MongoDB skipped in NODE_TEST_ENV.");
  }

  if (!isMongoConfigured()) {
    throw new Error("Petition draft storage is unavailable: MongoDB is not configured.");
  }

  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PetitionWorkingDraft>(
    MONGO_COLLECTIONS.initiativePetitionWorkingDrafts,
  );
}

const WITHOUT_MONGO_ID = { projection: { _id: 0 } } as const;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function insertPetitionWorkingDraft(draft: PetitionWorkingDraft): Promise<void> {
  await ensureReady();

  try {
    await collection().insertOne({ ...draft });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error(`Petition draft "${draft.draftId}" already exists.`);
    }
    throw error;
  }
}

export async function findPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return collection().findOne({ draftId, initiativeId }, WITHOUT_MONGO_ID);
}

/** Drafts of one Initiative, oldest first (ties by draftId). */
export async function listPetitionWorkingDrafts(
  initiativeId: string,
): Promise<PetitionWorkingDraft[]> {
  await ensureReady();
  return collection()
    .find({ initiativeId }, WITHOUT_MONGO_ID)
    .sort({ createdAt: 1, draftId: 1 })
    .toArray();
}

/** Updates only the named draft of the named Initiative; null when no such draft. */
export async function updatePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  update: PetitionWorkingDraftContentUpdate & { readonly updatedAt: string },
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return collection().findOneAndUpdate(
    { draftId, initiativeId },
    { $set: { ...update } },
    { returnDocument: "after", ...WITHOUT_MONGO_ID },
  );
}

/** Deletes only the named draft of the named Initiative; false when no such draft. */
export async function deletePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().deleteOne({ draftId, initiativeId });
  return result.deletedCount === 1;
}
