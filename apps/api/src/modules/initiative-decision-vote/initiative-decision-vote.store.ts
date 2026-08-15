import type { InitiativeDecisionVote, InitiativeDecisionVoteHistoryEntry } from "@hu/types";

import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import { createInitiativeDecisionVoteCastEvent } from "./initiative-decision-vote-cast.event.js";
import { createInitiativeDecisionVoteChangedEvent } from "./initiative-decision-vote-changed.event.js";
import {
  InitiativeDecisionVoteConcurrencyConflictError,
  InitiativeDecisionVoteEventInvariantConflictError,
} from "./initiative-decision-vote.errors.js";
import {
  buildInitiativeDecisionVoteHistoryId,
} from "./persistence/initiative-decision-vote-history.mongo-document.js";
import {
  buildInitiativeDecisionVoteId,
  toVoteResponse,
  type InitiativeDecisionVoteMongoRecord,
} from "./persistence/initiative-decision-vote.mongo-document.js";
import {
  deleteInitiativeDecisionVoteHistoryByVoteIdForTests,
  deleteInitiativeDecisionVotesByDecisionIdForTests,
  deleteInitiativeDecisionVotesByParticipantIdForTests,
  findInitiativeDecisionVoteByDecisionAndParticipant,
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
  participantId: string;
  initiativeId: string;
  choice: InitiativeDecisionVote["choice"];
  transparencyCohort: InitiativeDecisionVote["transparencyCohort"];
}

/**
 * The sole write path for Vote mutations (Recovery Task 31 Part 9).
 *
 * - First cast: `insert Vote` + `insert cast history row` inside one
 *   `runMongoTransaction` — commits atomically or not at all.
 * - Changed choice: optimistic-concurrency-guarded `update Vote` (Part 11,
 *   `voteId` + expected `version`) + `insert choice-changed history row`
 *   inside one `runMongoTransaction`.
 * - Same-choice re-submit: pure read, no transaction, no write, no history
 *   row (Part 9 no-op contract).
 *
 * Concurrency (Part 10): a first-cast duplicate-key race (two concurrent
 * callers computing the same deterministic `voteId`) and a changed-choice
 * version-mismatch race are both detected and resolved by re-reading
 * authoritative state and retrying — bounded by
 * `MAX_CONCURRENT_MUTATION_ATTEMPTS` — rather than surfacing a new
 * public error type to preserve Part 17 API compatibility. A real
 * multi-document transaction can also surface the same underlying race as
 * a driver-level `WriteConflict`/`TransientTransactionError` rather than a
 * clean duplicate-key error, depending on how two concurrent transactions
 * interleave; `isRetryableInitiativeDecisionVoteWriteError` recognizes both
 * shapes (including when wrapped in `InitiativeDecisionVotePersistenceError`)
 * so the retry loop, not raw driver error plumbing, is what a caller ever
 * observes. Only if the retry budget is exhausted (unreached by any tested
 * scenario) does a plain `Error`, consistent with this module's existing
 * all-plain-`Error` convention, escape to the caller.
 */
export async function castOrChangeInitiativeDecisionVote(
  input: CastOrChangeInitiativeDecisionVoteInput,
): Promise<InitiativeDecisionVote> {
  const voteId = buildInitiativeDecisionVoteId(input.decisionId, input.participantId);

  for (let attempt = 0; attempt < MAX_CONCURRENT_MUTATION_ATTEMPTS; attempt += 1) {
    const existing = await findInitiativeDecisionVoteByDecisionAndParticipant(
      input.decisionId,
      input.participantId,
    );

    if (existing) {
      if (existing.choice === input.choice) {
        return toVoteResponse(existing);
      }

      const timestamp = new Date().toISOString();
      const newVersion = existing.version + 1;

      // Recovery Task 32 Part 10/16 — constructed once per attempt, before
      // `runMongoTransaction` is entered, from the exact transition this
      // attempt is trying to commit. If this attempt loses the version race
      // (see the `!result` branch below, or a driver-level
      // TransientTransactionError), the transaction throws before the
      // enqueue is ever reached and this constant is simply discarded; the
      // next loop iteration re-reads authoritative state and builds a fresh
      // event from the actual winning transition — never a stale one.
      const changedEvent = createInitiativeDecisionVoteChangedEvent({
        voteId: existing.voteId,
        decisionId: input.decisionId,
        participantId: input.participantId,
        initiativeId: existing.initiativeId,
        previousChoice: existing.choice,
        newChoice: input.choice,
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
              historyId: buildInitiativeDecisionVoteHistoryId(
                input.decisionId,
                input.participantId,
                newVersion,
              ),
              voteId: existing.voteId,
              decisionId: input.decisionId,
              participantId: input.participantId,
              previousChoice: existing.choice,
              newChoice: input.choice,
              changedAt: timestamp,
              transparencyCohort: input.transparencyCohort,
            },
            { session },
          );

          // Recovery Task 32 Part 10 — enqueued only after the
          // version-guarded update above has already succeeded within this
          // same, still-uncommitted transaction: Vote update, history row,
          // and event share one ClientSession and commit or roll back
          // together (Part 9/17).
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
      choice: input.choice,
      transparencyCohort: input.transparencyCohort,
      castAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };

    // Recovery Task 32 Part 7/12 — constructed once per attempt, before
    // `runMongoTransaction` is entered, from the same deterministic `voteId`
    // and the single `timestamp` already used for the Vote document and its
    // cast history row (Part 8). A first-cast duplicate-key race (another
    // concurrent caller wins the same deterministic `voteId`) aborts this
    // attempt's whole transaction before the event is ever enqueued; the
    // next loop iteration re-reads authoritative state, finds the Vote now
    // exists, and falls into the "existing" branch above instead of
    // re-attempting a first cast — so this event is never constructed twice
    // for the same Vote.
    const castEvent = createInitiativeDecisionVoteCastEvent({
      voteId,
      decisionId: input.decisionId,
      participantId: input.participantId,
      initiativeId: input.initiativeId,
      choice: input.choice,
      votedAt: timestamp,
      voteVersion: 1,
    });

    try {
      await runMongoTransaction(async (session) => {
        await insertInitiativeDecisionVote(vote, { session });
        await insertInitiativeDecisionVoteHistory(
          {
            historyId: buildInitiativeDecisionVoteHistoryId(
              input.decisionId,
              input.participantId,
              1,
            ),
            voteId,
            decisionId: input.decisionId,
            participantId: input.participantId,
            newChoice: input.choice,
            changedAt: timestamp,
            transparencyCohort: input.transparencyCohort,
          },
          { session },
        );

        // Recovery Task 32 Part 9 — enqueued only after the Vote insert
        // above has already succeeded within this same, still-uncommitted
        // transaction: Vote, history row, and event share one
        // ClientSession and commit or roll back together (Part 17).
        await enqueueDomainEvent(castEvent, { session });

        // runMongoTransaction (Part 8) treats an `undefined` callback result
        // as "completed without returning a result" — an explicit true is
        // required even though this branch's real output is the `vote`
        // constant already in scope below.
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
