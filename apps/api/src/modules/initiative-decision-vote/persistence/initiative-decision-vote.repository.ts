import type { ClientSession } from "mongodb";

import type { InitiativeDecisionVoteChoiceExtended, InitiativeDecisionVoteHistoryEntry } from "@hu/types";
import type { PublicChoiceVoterCategory } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { InitiativeDecisionVotePersistenceError } from "../initiative-decision-vote.errors.js";
import {
  fromInitiativeDecisionVoteHistoryMongoDocument,
  toInitiativeDecisionVoteHistoryMongoDocument,
  type InitiativeDecisionVoteHistoryMongoDocument,
} from "./initiative-decision-vote-history.mongo-document.js";
import {
  fromInitiativeDecisionVoteMongoDocument,
  toInitiativeDecisionVoteMongoDocument,
  type InitiativeDecisionVoteMongoDocument,
  type InitiativeDecisionVoteMongoRecord,
} from "./initiative-decision-vote.mongo-document.js";

export function isDuplicateInitiativeDecisionVoteError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function hasTransientTransactionErrorLabel(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const withLabel = error as { hasErrorLabel?: (label: string) => boolean; errorLabelSet?: Set<string> };

  if (typeof withLabel.hasErrorLabel === "function") {
    return withLabel.hasErrorLabel("TransientTransactionError");
  }

  return withLabel.errorLabelSet instanceof Set && withLabel.errorLabelSet.has("TransientTransactionError");
}

/**
 * A real multi-document Mongo transaction can surface a concurrent-write
 * race as a `WriteConflict` (code 112, labeled `TransientTransactionError`)
 * rather than — or in addition to — a duplicate-key error, depending on
 * exactly how two concurrent transactions interleave under the storage
 * engine's optimistic concurrency control. Both signals mean the same thing
 * to `castOrChangeInitiativeDecisionVote`'s retry loop (Part 10/11): another
 * concurrent mutation is contending for the same Vote, and a fresh
 * read-then-retry is the correct, safe response — never a silently
 * swallowed or corrupted write. Since insert/history-insert failures are
 * wrapped in `InitiativeDecisionVotePersistenceError` (with the original
 * driver error preserved as `cause`), this also unwraps one level of
 * `cause` so the retry loop can recognize a wrapped transient error, not
 * only an unwrapped one.
 */
export function isRetryableInitiativeDecisionVoteWriteError(error: unknown): boolean {
  if (isDuplicateInitiativeDecisionVoteError(error) || hasTransientTransactionErrorLabel(error)) {
    return true;
  }

  if (error instanceof Error && error.cause !== undefined && error.cause !== error) {
    return isRetryableInitiativeDecisionVoteWriteError(error.cause);
  }

  return false;
}

async function ensureInitiativeDecisionVoteMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new InitiativeDecisionVotePersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

function votesCollection() {
  return getMongoCollection<InitiativeDecisionVoteMongoDocument>(
    MONGO_COLLECTIONS.initiativeDecisionVotes,
  );
}

function historyCollection() {
  return getMongoCollection<InitiativeDecisionVoteHistoryMongoDocument>(
    MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
  );
}

export interface RepositorySessionOptions {
  session?: ClientSession;
}

export async function insertInitiativeDecisionVote(
  record: InitiativeDecisionVoteMongoRecord,
  options: RepositorySessionOptions = {},
): Promise<void> {
  await ensureInitiativeDecisionVoteMongoReady();

  try {
    await votesCollection().insertOne(toInitiativeDecisionVoteMongoDocument(record), {
      session: options.session,
    });
  } catch (error) {
    if (isDuplicateInitiativeDecisionVoteError(error)) {
      throw error;
    }

    throw new InitiativeDecisionVotePersistenceError("Initiative Decision Vote insert failed.", error);
  }
}

export async function findInitiativeDecisionVoteById(
  voteId: string,
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord | null> {
  await ensureInitiativeDecisionVoteMongoReady();

  const document = await votesCollection().findOne({ voteId }, { session: options.session });

  return document ? fromInitiativeDecisionVoteMongoDocument(document) : null;
}

export async function findInitiativeDecisionVoteByDecisionAndParticipant(
  decisionId: string,
  participantId: string,
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord | null> {
  await ensureInitiativeDecisionVoteMongoReady();

  const document = await votesCollection().findOne(
    { decisionId, participantId },
    { session: options.session },
  );

  return document ? fromInitiativeDecisionVoteMongoDocument(document) : null;
}

export async function findInitiativeDecisionVoteByDecisionAndVisitor(
  decisionId: string,
  visitorKey: string,
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord | null> {
  await ensureInitiativeDecisionVoteMongoReady();

  const document = await votesCollection().findOne(
    { decisionId, visitorKey },
    { session: options.session },
  );

  return document ? fromInitiativeDecisionVoteMongoDocument(document) : null;
}

export async function countInitiativeDecisionVotesForCandidate(
  initiativeId: string,
  candidateId: string,
): Promise<number> {
  await ensureInitiativeDecisionVoteMongoReady();

  return votesCollection().countDocuments({
    initiativeId,
    choice: "candidate",
    candidateId,
  });
}

export async function listInitiativeDecisionVotesByDecision(
  decisionId: string,
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord[]> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await votesCollection()
    .find({ decisionId }, { session: options.session })
    .sort({ castAt: 1 })
    .toArray();

  return documents.map((document) => fromInitiativeDecisionVoteMongoDocument(document));
}

export async function listInitiativeDecisionVotesByParticipant(
  participantId: string,
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord[]> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await votesCollection()
    .find({ participantId }, { session: options.session })
    .sort({ castAt: 1 })
    .toArray();

  return documents.map((document) => fromInitiativeDecisionVoteMongoDocument(document));
}

/**
 * Global scan preserving the pre-existing `listAllVotes()` capability that
 * `platform-statistics.service.ts` depends on for active-member computation
 * (Recovery Task 31 Part 9/16 compatibility — not a new read pattern).
 */
export async function listAllInitiativeDecisionVotes(): Promise<InitiativeDecisionVoteMongoRecord[]> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await votesCollection().find({}).toArray();

  return documents.map((document) => fromInitiativeDecisionVoteMongoDocument(document));
}

/**
 * Optimistic-concurrency-guarded choice update (Part 11): matches only the
 * document that still has `expectedVersion`, mirroring
 * `updatePetitionConditionally`'s status-guarded `findOneAndUpdate` pattern.
 * Returns `null` — never throws — when another mutation won the race first,
 * so the caller (`castOrChangeInitiativeDecisionVote`) can reload and retry
 * instead of receiving a false failure.
 */
export async function updateInitiativeDecisionVoteChoice(
  params: {
    voteId: string;
    expectedVersion: number;
    choice: InitiativeDecisionVoteChoiceExtended;
    candidateId?: string | null;
    voterCategory?: PublicChoiceVoterCategory;
    transparencyCohort: InitiativeDecisionVoteMongoRecord["transparencyCohort"];
    updatedAt: string;
  },
  options: RepositorySessionOptions = {},
): Promise<InitiativeDecisionVoteMongoRecord | null> {
  await ensureInitiativeDecisionVoteMongoReady();

  try {
    const setFields: Record<string, unknown> = {
      choice: params.choice,
      transparencyCohort: params.transparencyCohort,
      updatedAt: params.updatedAt,
      version: params.expectedVersion + 1,
    };

    if (params.voterCategory) {
      setFields.voterCategory = params.voterCategory;
    }

    const unsetFields: Record<string, "" > = {};
    if (params.candidateId === null || params.candidateId === undefined) {
      unsetFields.candidateId = "";
    } else {
      setFields.candidateId = params.candidateId;
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) {
      update.$unset = unsetFields;
    }

    const document = await votesCollection().findOneAndUpdate(
      { voteId: params.voteId, version: params.expectedVersion },
      update,
      { returnDocument: "after", session: options.session },
    );

    return document ? fromInitiativeDecisionVoteMongoDocument(document) : null;
  } catch (error) {
    throw new InitiativeDecisionVotePersistenceError("Initiative Decision Vote update failed.", error);
  }
}

export async function insertInitiativeDecisionVoteHistory(
  entry: InitiativeDecisionVoteHistoryEntry,
  options: RepositorySessionOptions = {},
): Promise<void> {
  await ensureInitiativeDecisionVoteMongoReady();

  try {
    await historyCollection().insertOne(toInitiativeDecisionVoteHistoryMongoDocument(entry), {
      session: options.session,
    });
  } catch (error) {
    if (isDuplicateInitiativeDecisionVoteError(error)) {
      throw error;
    }

    throw new InitiativeDecisionVotePersistenceError(
      "Initiative Decision Vote history insert failed.",
      error,
    );
  }
}

export async function listInitiativeDecisionVoteHistoryByDecision(
  decisionId: string,
): Promise<InitiativeDecisionVoteHistoryEntry[]> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await historyCollection().find({ decisionId }).sort({ changedAt: 1 }).toArray();

  return documents.map((document) => fromInitiativeDecisionVoteHistoryMongoDocument(document));
}

export async function listInitiativeDecisionVoteHistoryByParticipant(
  decisionId: string,
  participantId: string,
): Promise<InitiativeDecisionVoteHistoryEntry[]> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await historyCollection()
    .find({ decisionId, participantId })
    .sort({ changedAt: 1 })
    .toArray();

  return documents.map((document) => fromInitiativeDecisionVoteHistoryMongoDocument(document));
}

/** Global scan preserving the pre-existing `listAllVoteHistory()` capability. */
export async function listAllInitiativeDecisionVoteHistory(): Promise<
  InitiativeDecisionVoteHistoryEntry[]
> {
  await ensureInitiativeDecisionVoteMongoReady();

  const documents = await historyCollection().find({}).toArray();

  return documents.map((document) => fromInitiativeDecisionVoteHistoryMongoDocument(document));
}

// --- Narrow test-only cleanup helpers (Recovery Task 31 Part 19) ---
// Exact selectors only; no delete-all, no wildcard mode, no production callers.

export async function deleteInitiativeDecisionVotesByDecisionIdForTests(
  decisionId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await votesCollection().deleteMany({ decisionId });

  return result.deletedCount ?? 0;
}

export async function deleteInitiativeDecisionVotesByParticipantIdForTests(
  participantId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await votesCollection().deleteMany({ participantId });

  return result.deletedCount ?? 0;
}

export async function deleteInitiativeDecisionVoteHistoryByVoteIdForTests(
  voteId: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const result = await historyCollection().deleteMany({ voteId });

  return result.deletedCount ?? 0;
}

/** Pack 02C — stamp temporary retention expiry on effective votes + history for one Decision. */
export async function stampInitiativeDecisionVoteExpireAtForDecision(
  decisionId: string,
  expireAt: string,
): Promise<void> {
  await ensureInitiativeDecisionVoteMongoReady();
  await votesCollection().updateMany({ decisionId }, { $set: { expireAt } });
  await historyCollection().updateMany({ decisionId }, { $set: { expireAt } });
}

/** Pack 02C — purge temporary PUBLIC_CHOICE election votes + history for one Decision. */
export async function deleteInitiativeDecisionVotesAndHistoryForDecision(
  decisionId: string,
): Promise<{ votes: number; history: number }> {
  await ensureInitiativeDecisionVoteMongoReady();
  const votes = await votesCollection().deleteMany({ decisionId });
  const history = await historyCollection().deleteMany({ decisionId });
  return {
    votes: votes.deletedCount ?? 0,
    history: history.deletedCount ?? 0,
  };
}
