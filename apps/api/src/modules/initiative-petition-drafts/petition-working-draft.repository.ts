import type { ClientSession } from "mongodb";

import { isExplicitIsolatedMongoTest } from "../../infrastructure/mongodb/explicit-isolated-mongo-test.js";
import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import type {
  PetitionWorkingDraft,
  PetitionWorkingDraftContentUpdate,
  PetitionWorkingDraftGeneratedFields,
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

/**
 * HU-LC-05C.4C — while a publication attempt owns the draft's slot, the stored
 * draft carries that attempt's id and no content write or delete matches it.
 * Internal only: never returned to callers.
 */
type PetitionWorkingDraftDocument = PetitionWorkingDraft & {
  readonly publishingAttemptId?: string | null;
};

function collection() {
  return getMongoCollection<PetitionWorkingDraftDocument>(
    MONGO_COLLECTIONS.initiativePetitionWorkingDrafts,
  );
}

const WITHOUT_MONGO_ID = { projection: { _id: 0, publishingAttemptId: 0 } } as const;

/** Matches a draft that no publication attempt has locked (field absent or null). */
const UNLOCKED = { publishingAttemptId: null } as const;

/** Drafts stored before HU-LC-05C.4B carry no traceability yet. */
function withTraceability(draft: PetitionWorkingDraft): PetitionWorkingDraft;
function withTraceability(draft: PetitionWorkingDraft | null): PetitionWorkingDraft | null;
function withTraceability(draft: PetitionWorkingDraft | null): PetitionWorkingDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    revisionId: draft.revisionId ?? null,
    revisionVersion: draft.revisionVersion ?? null,
    analysisId: draft.analysisId ?? null,
    analysisVersion: draft.analysisVersion ?? null,
    proposalIds: draft.proposalIds ?? [],
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function insertPetitionWorkingDraft(
  draft: PetitionWorkingDraft,
  session?: ClientSession,
): Promise<void> {
  await ensureReady();

  try {
    await collection().insertOne({ ...draft }, { session });
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
  session?: ClientSession,
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return withTraceability(
    await collection().findOne({ draftId, initiativeId }, { ...WITHOUT_MONGO_ID, session }),
  );
}

/** True while a publication attempt holds the draft. */
export async function isPetitionWorkingDraftLocked(
  initiativeId: string,
  draftId: string,
): Promise<boolean> {
  await ensureReady();
  const locked = await collection().findOne(
    { draftId, initiativeId, publishingAttemptId: { $type: "string" } },
    { projection: { _id: 1 } },
  );
  return locked !== null;
}

/** Locks an unlocked draft for one publication attempt; false when absent or already locked. */
export async function lockPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  attemptId: string,
  session: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().updateOne(
    { draftId, initiativeId, ...UNLOCKED },
    { $set: { publishingAttemptId: attemptId } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Moves the lock from an expired attempt to the attempt that took the reservation over. */
export async function transferPetitionWorkingDraftLock(
  initiativeId: string,
  draftId: string,
  fromAttemptId: string | null,
  toAttemptId: string,
  session: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().updateOne(
    { draftId, initiativeId, publishingAttemptId: fromAttemptId },
    { $set: { publishingAttemptId: toAttemptId } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Releases the lock held by one attempt; false when that attempt does not hold it. */
export async function unlockPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  attemptId: string | null,
  session: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().updateOne(
    { draftId, initiativeId, publishingAttemptId: attemptId },
    { $set: { publishingAttemptId: null } },
    { session },
  );
  return result.matchedCount === 1;
}

/** Inside the finalizing transaction: deletes the draft its own attempt has published. */
export async function deletePublishedPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  attemptId: string,
  session: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().deleteOne(
    { draftId, initiativeId, publishingAttemptId: attemptId },
    { session },
  );
  return result.deletedCount === 1;
}

/** Drafts of one Initiative, oldest first (ties by draftId). */
export async function listPetitionWorkingDrafts(
  initiativeId: string,
): Promise<PetitionWorkingDraft[]> {
  await ensureReady();
  const drafts = await collection()
    .find({ initiativeId }, WITHOUT_MONGO_ID)
    .sort({ createdAt: 1, draftId: 1 })
    .toArray();
  return drafts.map((draft) => withTraceability(draft));
}

/** Updates only the named, unlocked draft of the named Initiative; null otherwise. */
export async function updatePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  update: PetitionWorkingDraftContentUpdate & { readonly updatedAt: string },
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return withTraceability(
    await collection().findOneAndUpdate(
      { draftId, initiativeId, ...UNLOCKED },
      { $set: { ...update } },
      { returnDocument: "after", ...WITHOUT_MONGO_ID },
    ),
  );
}

/**
 * HU-LC-05C.4B — writes generated content and its traceability in one update,
 * only while the draft still holds exactly the content (and updatedAt) the
 * caller inspected; null when the draft is gone or was changed meanwhile.
 */
export async function applyGeneratedPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  inspected: PetitionWorkingDraft,
  generated: PetitionWorkingDraftGeneratedFields,
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return withTraceability(
    await collection().findOneAndUpdate(
      {
        draftId,
        initiativeId,
        ...UNLOCKED,
        updatedAt: inspected.updatedAt,
        title: inspected.title,
        publicSummary: inspected.publicSummary,
        requestStatement: inspected.requestStatement,
        expectedOutcome: inspected.expectedOutcome,
        supportingContext: inspected.supportingContext,
        keyArguments: [...inspected.keyArguments],
      },
      { $set: { ...generated, keyArguments: [...generated.keyArguments] } },
      { returnDocument: "after", ...WITHOUT_MONGO_ID },
    ),
  );
}

/** Deletes only the named, unlocked draft of the named Initiative; false otherwise. */
export async function deletePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  session?: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().deleteOne({ draftId, initiativeId, ...UNLOCKED }, { session });
  return result.deletedCount === 1;
}
