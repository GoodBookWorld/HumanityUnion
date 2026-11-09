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

function collection() {
  return getMongoCollection<PetitionWorkingDraft>(
    MONGO_COLLECTIONS.initiativePetitionWorkingDrafts,
  );
}

const WITHOUT_MONGO_ID = { projection: { _id: 0 } } as const;

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
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return withTraceability(await collection().findOne({ draftId, initiativeId }, WITHOUT_MONGO_ID));
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

/** Updates only the named draft of the named Initiative; null when no such draft. */
export async function updatePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  update: PetitionWorkingDraftContentUpdate & { readonly updatedAt: string },
): Promise<PetitionWorkingDraft | null> {
  await ensureReady();
  return withTraceability(
    await collection().findOneAndUpdate(
      { draftId, initiativeId },
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

/** Deletes only the named draft of the named Initiative; false when no such draft. */
export async function deletePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  session?: ClientSession,
): Promise<boolean> {
  await ensureReady();
  const result = await collection().deleteOne({ draftId, initiativeId }, { session });
  return result.deletedCount === 1;
}
