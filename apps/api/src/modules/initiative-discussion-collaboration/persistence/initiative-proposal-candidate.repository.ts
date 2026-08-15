import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";

import type { InitiativeDiscussionProposalCandidate } from "@hu/types";

import { InitiativeDiscussionProposalCandidatePersistenceError } from "../initiative-discussion-collaboration.errors.js";
import {
  fromInitiativeDiscussionProposalCandidateMongoDocument,
  toInitiativeDiscussionProposalCandidateMongoDocument,
  type InitiativeDiscussionProposalCandidateMongoDocument,
} from "./initiative-proposal-candidate.mongo-document.js";

export function isDuplicateProposalCandidateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureProposalCandidateMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function candidatesCollection() {
  return getMongoCollection<InitiativeDiscussionProposalCandidateMongoDocument>(
    MONGO_COLLECTIONS.initiativeDiscussionProposalCandidates,
  );
}

/**
 * Insert-once, immutable (Part 6: at most one candidate per
 * sourceCommentId). Rethrows a raw duplicate-key error unwrapped so callers
 * (`createProposalCandidateFromComment`) can distinguish "another concurrent
 * creation already won" from a genuine persistence failure and fall back to
 * a fresh read of the now-existing candidate, exactly mirroring
 * `insertInitiativeDecisionVote` / `insertPetitionSignatureDocument`.
 */
export async function insertProposalCandidateDocument(
  record: InitiativeDiscussionProposalCandidate,
): Promise<void> {
  await ensureProposalCandidateMongoReady();

  try {
    await candidatesCollection().insertOne(
      toInitiativeDiscussionProposalCandidateMongoDocument(record),
    );
  } catch (error) {
    if (isDuplicateProposalCandidateError(error)) {
      throw error;
    }

    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      "Proposal Candidate insert failed.",
      error,
    );
  }
}

export async function findProposalCandidateDocumentByCommentId(
  commentId: string,
): Promise<InitiativeDiscussionProposalCandidate | null> {
  await ensureProposalCandidateMongoReady();

  const document = await candidatesCollection().findOne({ sourceCommentId: commentId });

  return document ? fromInitiativeDiscussionProposalCandidateMongoDocument(document) : null;
}

/**
 * Bounded batched lookup, mirroring `listSignaturesByPetitionIds` — avoids
 * one Mongo round trip per comment when reconstructing a whole discussion
 * thread's collaboration state at once.
 */
export async function listProposalCandidateDocumentsByCommentIds(
  commentIds: readonly string[],
): Promise<Map<string, InitiativeDiscussionProposalCandidate>> {
  const result = new Map<string, InitiativeDiscussionProposalCandidate>();

  if (commentIds.length === 0) {
    return result;
  }

  await ensureProposalCandidateMongoReady();

  const documents = await candidatesCollection()
    .find({ sourceCommentId: { $in: [...commentIds] } })
    .toArray();

  for (const document of documents) {
    const record = fromInitiativeDiscussionProposalCandidateMongoDocument(document);
    result.set(record.sourceCommentId, record);
  }

  return result;
}

// --- Narrow test-only cleanup helper. Exact selector only; no delete-all,
// no wildcard mode, no production callers (Recovery Task 31 Part 19 style).

export async function deleteProposalCandidatesByInitiativeIdForTests(
  initiativeId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await candidatesCollection().deleteMany({ initiativeId });

  return result.deletedCount ?? 0;
}
