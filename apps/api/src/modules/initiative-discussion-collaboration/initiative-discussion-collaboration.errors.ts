/**
 * UX Evolution Pack 02.1 — Recover Durable Persistence.
 *
 * Narrow error types for the Mongo-backed Ally / Proposal Candidate
 * persistence boundary, mirroring the shape already established for
 * Petition/Petition Signature (`petition.errors.ts`) and Initiative
 * Decision Vote (`initiative-decision-vote.errors.ts`).
 */

export class InitiativeAllyPersistenceError extends Error {
  readonly code = "INITIATIVE_ALLY_PERSISTENCE_ERROR";

  constructor(message = "Initiative Ally persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "InitiativeAllyPersistenceError";
  }
}

export class InitiativeDiscussionProposalCandidatePersistenceError extends Error {
  readonly code = "INITIATIVE_DISCUSSION_PROPOSAL_CANDIDATE_PERSISTENCE_ERROR";

  constructor(
    message = "Initiative Discussion Proposal Candidate persistence failed.",
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "InitiativeDiscussionProposalCandidatePersistenceError";
  }
}
