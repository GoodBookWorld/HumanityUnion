/**
 * Recovery Task 31 — narrow error types for the Mongo-backed Initiative
 * Decision Vote persistence boundary, mirroring the shape already
 * established for Petition/Petition Signature (`petition.errors.ts`).
 */

export class InitiativeDecisionVotePersistenceError extends Error {
  readonly code = "INITIATIVE_DECISION_VOTE_PERSISTENCE_ERROR";

  constructor(message = "Initiative Decision Vote persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "InitiativeDecisionVotePersistenceError";
  }
}

export class InitiativeDecisionVoteTransactionError extends Error {
  readonly code = "INITIATIVE_DECISION_VOTE_TRANSACTION_ERROR";

  constructor(message = "Initiative Decision Vote transaction failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "InitiativeDecisionVoteTransactionError";
  }
}

/**
 * Raised internally when an optimistic-concurrency guarded update
 * (`voteId` + expected `version`) matches no document because another
 * mutation committed first, or when a first-cast insert loses a
 * duplicate-key race. `castOrChangeInitiativeDecisionVote` (Part 9/10/11)
 * catches this and retries with a fresh read; it is only ever allowed to
 * escape to a caller if the bounded retry budget is exhausted, which is not
 * reachable in the tested concurrency scenarios (Part 20 §Concurrency).
 */
export class InitiativeDecisionVoteConcurrencyConflictError extends Error {
  readonly code = "INITIATIVE_DECISION_VOTE_CONCURRENCY_CONFLICT";

  constructor(message = "Vote was concurrently modified. Please retry.") {
    super(message);
    this.name = "InitiativeDecisionVoteConcurrencyConflictError";
  }
}

/**
 * Recovery Task 32 Part 15 — thrown by the Cast/Changed event factories when
 * a constructed payload fails narrow, event-specific runtime validation
 * (missing identity field, invalid choice, malformed timestamp, invalid or
 * non-incrementing version, equal previous/new choice). Deliberately
 * distinct from `InitiativeDecisionVotePersistenceError` — this represents a
 * programming-time contract violation in the event payload itself, never a
 * Mongo I/O failure.
 */
export class InitiativeDecisionVoteEventValidationError extends Error {
  readonly code = "INITIATIVE_DECISION_VOTE_EVENT_VALIDATION_ERROR";

  constructor(message = "Initiative Decision Vote event payload is invalid.") {
    super(message);
    this.name = "InitiativeDecisionVoteEventValidationError";
  }
}

/**
 * Recovery Task 32 Part 13 — thrown when a duplicate-key error is detected
 * on the outbox's `eventId` unique index or the history collection's
 * `historyId` unique index while the enclosing Vote mutation is otherwise
 * new (not a losing side of the already-handled `voteId`/version
 * concurrency race, both of which remain retryable via
 * `isRetryableInitiativeDecisionVoteWriteError`). Because event/history
 * identity is a pure deterministic function of already-uniquely-enforced
 * Vote state (`voteId`, and for Changed, the version transition guarded by
 * `updateInitiativeDecisionVoteChoice`), this should be unreachable outside
 * deliberate fault injection or a genuine data-integrity bug — retrying it
 * would only repeat the same failure, so `castOrChangeInitiativeDecisionVote`
 * surfaces it distinctly instead of silently looping or committing a Vote
 * without its matching durable event.
 */
export class InitiativeDecisionVoteEventInvariantConflictError extends Error {
  readonly code = "INITIATIVE_DECISION_VOTE_EVENT_INVARIANT_CONFLICT";

  constructor(
    message = "Initiative Decision Vote event invariant conflict detected.",
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "InitiativeDecisionVoteEventInvariantConflictError";
  }
}
