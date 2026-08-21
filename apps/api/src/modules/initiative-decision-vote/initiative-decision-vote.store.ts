import type {
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoiceExtended,
  InitiativeDecisionVoteHistoryEntry,
  PublicChoiceVoterCategory,
} from "@hu/types";
import { assertDecisionVoteVoterIdentity } from "@hu/types";

import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import { createInitiativeDecisionVoteCastEvent } from "./initiative-decision-vote-cast.event.js";
import { createInitiativeDecisionVoteChangedEvent } from "./initiative-decision-vote-changed.event.js";
import {
  InitiativeDecisionVoteConcurrencyConflictError,
  InitiativeDecisionVoteEventInvariantConflictError,
} from "./initiative-decision-vote.errors.js";
import { buildInitiativeDecisionVoteHistoryIdForVoter } from "./persistence/initiative-decision-vote-history.mongo-document.js";
import {
  buildInitiativeDecisionVoteIdForVoter,
  toVoteResponse,
  type InitiativeDecisionVoteMongoRecord,
} from "./persistence/initiative-decision-vote.mongo-document.js";
import {
  deleteInitiativeDecisionVoteHistoryByVoteIdForTests,
  deleteInitiativeDecisionVotesByDecisionIdForTests,
  deleteInitiativeDecisionVotesByParticipantIdForTests,
  findInitiativeDecisionVoteByDecisionAndParticipant,
  findInitiativeDecisionVoteByDecisionAndVisitor,
  findInitiativeDecisionVoteById,
  insertInitiativeDecisionVote,
  insertInitiativeDecisionVoteHistory,
  isDuplicateInitiativeDecisionVoteError,
  isRetryableInitiativeDecisionVoteWriteError,
  listAllInitiativeDecisionVoteHistory,
  listAllInitiativeDecisionVotes,
  listInitiativeDecisionVoteHistoryByDecision,
  listInitiativeDecisionVoteHistoryByParticipant,
  listInitiativeDecisionVotesByDecision,
  listInitiativeDecisionVotesByParticipant,
  updateInitiativeDecisionVoteChoice,
  deleteInitiativeDecisionVoteById,
} from "./persistence/initiative-decision-vote.repository.js";

/**
 * Recovery Task 32 Part 13 — a duplicate-key error hitting the outbox's
 * `eventId` unique index or the history collection's `historyId` unique
 * index, while a Vote mutation is otherwise new, is never a legitimate
 * concurrency race: `voteId` uniqueness (first cast) and the
 * version-guarded `updateInitiativeDecisionVoteChoice` (changed choice)
 * already guarantee that only the single winning attempt of any real race
 * ever reaches the history/event insert in the first place. Reaching this
 * duplicate-key shape therefore means a pre-existing colliding document was
 * already present (deliberate fault injection, or a genuine data-integrity
 * bug) — retrying would only reproduce the identical failure, so this is
 * classified as a non-retryable invariant conflict instead of being handed
 * to `isRetryableInitiativeDecisionVoteWriteError`. Vote's own natural-key/
 * voteId duplicate indexes are deliberately NOT included here — those
 * remain retryable exactly as established by Recovery Task 31.
 */
const NON_RETRYABLE_EVENT_INVARIANT_DUPLICATE_INDEX_NAMES = [
  "outbox_event_id_unique",
  "initiative_decision_vote_history_history_id_unique",
];

function isNonRetryableEventInvariantDuplicateError(error: unknown): boolean {
  if (!isDuplicateInitiativeDecisionVoteError(error)) {
    return false;
  }

  const withDetails = error as {
    keyPattern?: Record<string, unknown>;
    message?: string;
    errmsg?: string;
  };
  const text = withDetails.message ?? withDetails.errmsg ?? "";

  if (
    NON_RETRYABLE_EVENT_INVARIANT_DUPLICATE_INDEX_NAMES.some((indexName) => text.includes(indexName))
  ) {
    return true;
  }

  if (
    withDetails.keyPattern &&
    ("eventId" in withDetails.keyPattern || "historyId" in withDetails.keyPattern)
  ) {
    return true;
  }

  return false;
}

/**
 * Recovery Task 31 — this module is now a thin facade over the dedicated,
 * transaction-capable Mongo repository (`persistence/*.repository.ts`),
 * preserving the exported function names the service/routes/aggregates/
 * platform-statistics call sites already depend on, but every function is
 * now `async` (a Mongo-backed read/write cannot be synchronous) and every
 * write is either a single-document, session-optional repository call or
 * routed through `castOrChangeInitiativeDecisionVote` below, which is the
 * sole transaction boundary for Vote mutations (Part 9).
 *
 * There is no more module-level in-memory Map, no file/snapshot adapter,
 * and no fire-and-forget Mongo mirror (Part 15): Mongo is the only
 * authoritative persistence for Initiative Decision Votes.
 */

const MAX_CONCURRENT_MUTATION_ATTEMPTS = 5;

export interface CastOrChangeInitiativeDecisionVoteInput {
  decisionId: string;
  initiativeId: string;
  /** XOR with visitorKey — STANDARD and PUBLIC_CHOICE Participant/Member. */
  participantId?: string;
  /** XOR with participantId — PUBLIC_CHOICE Visitor only. */
  visitorKey?: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
  voterCategory?: PublicChoiceVoterCategory;
  transparencyCohort: InitiativeDecisionVote["transparencyCohort"];
}

function ballotEquals(
  left: { choice: string; candidateId?: string },
  right: { choice: string; candidateId?: string },
): boolean {
  return (
    left.choice === right.choice &&
    (left.candidateId ?? undefined) === (right.candidateId ?? undefined)
  );
}

async function findExistingVoteForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
}): Promise<InitiativeDecisionVoteMongoRecord | null> {
  if (input.participantId) {
    return findInitiativeDecisionVoteByDecisionAndParticipant(
      input.decisionId,
      input.participantId,
    );
  }

  if (input.visitorKey) {
    return findInitiativeDecisionVoteByDecisionAndVisitor(input.decisionId, input.visitorKey);
  }

  return null;
}

/**
 * The sole write path for Vote mutations (Recovery Task 31 Part 9 + Pack 02B).
 * Supports participant XOR visitor on one Mongo Decision Vote collection.
 */
export async function castOrChangeInitiativeDecisionVote(
  input: CastOrChangeInitiativeDecisionVoteInput,
): Promise<InitiativeDecisionVote> {
  assertDecisionVoteVoterIdentity(input);
  const voteId = buildInitiativeDecisionVoteIdForVoter(input);
  const nextCandidateId = input.choice === "candidate" ? input.candidateId : undefined;

  for (let attempt = 0; attempt < MAX_CONCURRENT_MUTATION_ATTEMPTS; attempt += 1) {
    const existing = await findExistingVoteForVoter(input);

    if (existing) {
      if (ballotEquals(existing, { choice: input.choice, candidateId: nextCandidateId })) {
        return toVoteResponse(existing);
      }

      const timestamp = new Date().toISOString();
      const newVersion = existing.version + 1;

      const changedEvent = createInitiativeDecisionVoteChangedEvent({
        voteId: existing.voteId,
        decisionId: input.decisionId,
        participantId: input.participantId,
        initiativeId: existing.initiativeId,
        previousChoice: existing.choice,
        newChoice: input.choice,
        previousCandidateId: existing.candidateId,
        newCandidateId: nextCandidateId,
        changedAt: timestamp,
        previousVoteVersion: existing.version,
        newVoteVersion: newVersion,
      });

      try {
        const updated = await runMongoTransaction(async (session) => {
          const result = await updateInitiativeDecisionVoteChoice(
            {
              voteId: existing.voteId,
              expectedVersion: existing.version,
              choice: input.choice,
              candidateId: nextCandidateId ?? null,
              voterCategory: input.voterCategory,
              transparencyCohort: input.transparencyCohort,
              updatedAt: timestamp,
            },
            { session },
          );

          if (!result) {
            throw new InitiativeDecisionVoteConcurrencyConflictError();
          }

          await insertInitiativeDecisionVoteHistory(
            {
              historyId: buildInitiativeDecisionVoteHistoryIdForVoter({
                decisionId: input.decisionId,
                participantId: input.participantId,
                visitorKey: input.visitorKey,
                newVersion,
              }),
              voteId: existing.voteId,
              decisionId: input.decisionId,
              participantId: input.participantId,
              visitorKey: input.visitorKey,
              previousChoice: existing.choice,
              previousCandidateId: existing.candidateId,
              newChoice: input.choice,
              newCandidateId: nextCandidateId,
              changedAt: timestamp,
              transparencyCohort: input.transparencyCohort,
              voterCategory: input.voterCategory,
            },
            { session },
          );

          await enqueueDomainEvent(changedEvent, { session });

          return result;
        });

        return toVoteResponse(updated);
      } catch (error) {
        if (isNonRetryableEventInvariantDuplicateError(error)) {
          throw new InitiativeDecisionVoteEventInvariantConflictError(
            "Initiative Decision Vote change committed a duplicate history/event identity that must not be silently retried.",
            error,
          );
        }

        if (
          error instanceof InitiativeDecisionVoteConcurrencyConflictError ||
          isRetryableInitiativeDecisionVoteWriteError(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    const timestamp = new Date().toISOString();
    const vote: InitiativeDecisionVoteMongoRecord = {
      voteId,
      decisionId: input.decisionId,
      initiativeId: input.initiativeId,
      participantId: input.participantId,
      visitorKey: input.visitorKey,
      choice: input.choice,
      candidateId: nextCandidateId,
      voterCategory: input.voterCategory,
      transparencyCohort: input.transparencyCohort,
      castAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };

    const castEvent = createInitiativeDecisionVoteCastEvent({
      voteId,
      decisionId: input.decisionId,
      participantId: input.participantId,
      initiativeId: input.initiativeId,
      choice: input.choice,
      candidateId: nextCandidateId,
      votedAt: timestamp,
      voteVersion: 1,
    });

    try {
      await runMongoTransaction(async (session) => {
        await insertInitiativeDecisionVote(vote, { session });
        await insertInitiativeDecisionVoteHistory(
          {
            historyId: buildInitiativeDecisionVoteHistoryIdForVoter({
              decisionId: input.decisionId,
              participantId: input.participantId,
              visitorKey: input.visitorKey,
              newVersion: 1,
            }),
            voteId,
            decisionId: input.decisionId,
            participantId: input.participantId,
            visitorKey: input.visitorKey,
            newChoice: input.choice,
            newCandidateId: nextCandidateId,
            changedAt: timestamp,
            transparencyCohort: input.transparencyCohort,
            voterCategory: input.voterCategory,
          },
          { session },
        );

        await enqueueDomainEvent(castEvent, { session });

        return true;
      });

      return toVoteResponse(vote);
    } catch (error) {
      if (isNonRetryableEventInvariantDuplicateError(error)) {
        throw new InitiativeDecisionVoteEventInvariantConflictError(
          "Initiative Decision Vote first cast committed a duplicate history/event identity that must not be silently retried.",
          error,
        );
      }

      if (isRetryableInitiativeDecisionVoteWriteError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new InitiativeDecisionVoteConcurrencyConflictError(
    "Vote could not be recorded after repeated concurrent updates. Please try again.",
  );
}

export async function getVoteById(voteId: string): Promise<InitiativeDecisionVote | null> {
  const record = await findInitiativeDecisionVoteById(voteId);

  return record ? toVoteResponse(record) : null;
}

export async function getActiveVoteForParticipant(
  decisionId: string,
  participantId: string,
): Promise<InitiativeDecisionVote | null> {
  const record = await findInitiativeDecisionVoteByDecisionAndParticipant(decisionId, participantId);

  return record ? toVoteResponse(record) : null;
}

export async function getActiveVoteForVisitor(
  decisionId: string,
  visitorKey: string,
): Promise<InitiativeDecisionVote | null> {
  const record = await findInitiativeDecisionVoteByDecisionAndVisitor(decisionId, visitorKey);

  return record ? toVoteResponse(record) : null;
}

export async function listVotesForDecision(decisionId: string): Promise<InitiativeDecisionVote[]> {
  const records = await listInitiativeDecisionVotesByDecision(decisionId);

  return records.map((record) => toVoteResponse(record));
}

export async function listVotesForParticipant(
  participantId: string,
): Promise<InitiativeDecisionVote[]> {
  const records = await listInitiativeDecisionVotesByParticipant(participantId);

  return records.map((record) => toVoteResponse(record));
}

export async function listAllVotes(): Promise<InitiativeDecisionVote[]> {
  const records = await listAllInitiativeDecisionVotes();

  return records.map((record) => toVoteResponse(record));
}

export async function listAllVoteHistory(): Promise<InitiativeDecisionVoteHistoryEntry[]> {
  return listAllInitiativeDecisionVoteHistory();
}

export async function listVoteHistoryForDecision(
  decisionId: string,
): Promise<InitiativeDecisionVoteHistoryEntry[]> {
  return listInitiativeDecisionVoteHistoryByDecision(decisionId);
}

export async function listVoteHistoryForParticipant(
  decisionId: string,
  participantId: string,
): Promise<InitiativeDecisionVoteHistoryEntry[]> {
  return listInitiativeDecisionVoteHistoryByParticipant(decisionId, participantId);
}

export async function countActiveVotesForDecision(decisionId: string): Promise<number> {
  const votes = await listVotesForDecision(decisionId);

  return votes.length;
}

/**
 * Pack 04 — Recall: remove the caller's effective vote so Select is unlocked again.
 * Prior history rows remain; the active vote document is deleted.
 */
export async function recallInitiativeDecisionVoteForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
}): Promise<boolean> {
  assertDecisionVoteVoterIdentity(input);
  const existing = await findExistingVoteForVoter(input);
  if (!existing) {
    return false;
  }

  return deleteInitiativeDecisionVoteById(existing.voteId);
}

/**
 * Test-only cleanup helper (unchanged name/signature from pre-Task-31,
 * still scoped narrowly to one participant's own votes and their history —
 * Recovery Task 31 Part 19). A participant may now have at most one Vote
 * per Decision but could have voted on multiple Decisions across a test
 * run, so history is removed per-`voteId` after first listing that
 * participant's votes, never by a blanket `participantId` history query.
 */
export async function deleteVotesByParticipantIdForTests(participantId: string): Promise<void> {
  const votes = await listInitiativeDecisionVotesByParticipant(participantId);

  for (const vote of votes) {
    await deleteInitiativeDecisionVoteHistoryByVoteIdForTests(vote.voteId);
  }

  await deleteInitiativeDecisionVotesByParticipantIdForTests(participantId);
}

/** New in Recovery Task 31: decision-scoped counterpart, for concurrency fixtures spanning multiple participants on one Decision. */
export async function deleteVotesByDecisionIdForTests(decisionId: string): Promise<void> {
  const votes = await listInitiativeDecisionVotesByDecision(decisionId);

  for (const vote of votes) {
    await deleteInitiativeDecisionVoteHistoryByVoteIdForTests(vote.voteId);
  }

  await deleteInitiativeDecisionVotesByDecisionIdForTests(decisionId);
}
