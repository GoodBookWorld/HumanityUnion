/**
 * Recovery Task 27 — Participant Action ledger error vocabulary. Mirrors the
 * existing per-module `Error` subclass convention (see
 * `../petition/petition.errors.ts`, `../workspace/workspace.errors.ts`).
 */
export class ParticipantActionValidationError extends Error {
  readonly code = "PARTICIPANT_ACTION_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ParticipantActionValidationError";
  }
}

export class ParticipantActionPersistenceError extends Error {
  readonly code = "PARTICIPANT_ACTION_PERSISTENCE_ERROR";

  constructor(message = "Participant Action persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "ParticipantActionPersistenceError";
  }
}

/**
 * Recovery Task 33 Part 12 — raised only when an insert hits an existing
 * `participantActionId`/`sourceEventId` unique-index conflict whose stored
 * content does not match the newly-computed, deterministic projection (an
 * invariant conflict, never a legitimate at-least-once replay). A compatible
 * duplicate (identical content) is never an error — it is reported as the
 * existing `"idempotent_replay"` insert outcome.
 */
export class ParticipantActionConflictError extends Error {
  readonly code = "PARTICIPANT_ACTION_CONFLICT_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ParticipantActionConflictError";
  }
}
