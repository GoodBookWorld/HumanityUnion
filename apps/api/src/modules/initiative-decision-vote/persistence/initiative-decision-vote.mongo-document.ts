import type { Document } from "mongodb";

import type {
  InitiativeCollectiveDecisionId,
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteId,
  ParticipationTransparencyCohort,
} from "@hu/types";

import { InitiativeDecisionVotePersistenceError } from "../initiative-decision-vote.errors.js";

const VALID_CHOICES = new Set<InitiativeDecisionVoteChoice>([
  "support",
  "do_not_support",
  "abstain",
]);
const VALID_COHORTS = new Set<ParticipationTransparencyCohort>(["verified", "unverified"]);

/**
 * Authoritative Mongo document for the `initiative_decision_votes`
 * collection (Recovery Task 31 Part 4/6).
 *
 * `initiativeId` is an intentional duplication of the parent Collective
 * Decision's already-validated, immutable Initiative ancestry, captured at
 * first-cast time (Part 13). It exists only so a future durable event can be
 * constructed with zero post-commit Initiative/Decision lookup (Part 18); it
 * is never exposed on the externally visible `InitiativeDecisionVote`
 * response shape (`fromInitiativeDecisionVoteMongoDocument` below strips it,
 * matching `toSignatureResponse`'s treatment of Petition Signature's own
 * `initiativeId`).
 */
export interface InitiativeDecisionVoteMongoDocument extends Document {
  voteId: InitiativeDecisionVoteId;
  decisionId: InitiativeCollectiveDecisionId;
  initiativeId: string;
  participantId: string;
  choice: InitiativeDecisionVoteChoice;
  transparencyCohort: ParticipationTransparencyCohort;
  castAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Internal repository-facing record: the full persisted shape, including
 * `initiativeId`. Distinct from the public `InitiativeDecisionVote` (which
 * has no `initiativeId` field — Model C, unchanged since Recovery Task 10).
 */
export type InitiativeDecisionVoteMongoRecord = InitiativeDecisionVote & {
  initiativeId: string;
};

export function toInitiativeDecisionVoteMongoDocument(
  record: InitiativeDecisionVoteMongoRecord,
): InitiativeDecisionVoteMongoDocument {
  return {
    voteId: record.voteId,
    decisionId: record.decisionId,
    initiativeId: record.initiativeId,
    participantId: record.participantId,
    choice: record.choice,
    transparencyCohort: record.transparencyCohort,
    castAt: record.castAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

/**
 * Rejects malformed persisted Vote documents rather than silently coercing
 * them (Part 6) — a legacy or corrupted document missing a required field,
 * carrying an invalid `choice`/`transparencyCohort`, or a non-positive
 * `version` fails loudly instead of being handed to the domain layer.
 */
export function fromInitiativeDecisionVoteMongoDocument(
  document: InitiativeDecisionVoteMongoDocument,
): InitiativeDecisionVoteMongoRecord {
  if (typeof document.voteId !== "string" || document.voteId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      "Persisted Initiative Decision Vote is missing a valid voteId.",
    );
  }

  if (typeof document.decisionId !== "string" || document.decisionId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" is missing a valid decisionId.`,
    );
  }

  if (typeof document.initiativeId !== "string" || document.initiativeId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" is missing a valid initiativeId.`,
    );
  }

  if (typeof document.participantId !== "string" || document.participantId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" is missing a valid participantId.`,
    );
  }

  if (!VALID_CHOICES.has(document.choice)) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid choice.`,
    );
  }

  if (!VALID_COHORTS.has(document.transparencyCohort)) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid transparencyCohort.`,
    );
  }

  if (typeof document.castAt !== "string" || Number.isNaN(Date.parse(document.castAt))) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid castAt.`,
    );
  }

  if (typeof document.updatedAt !== "string" || Number.isNaN(Date.parse(document.updatedAt))) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid updatedAt.`,
    );
  }

  if (typeof document.version !== "number" || !Number.isInteger(document.version) || document.version < 1) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid version.`,
    );
  }

  return {
    voteId: document.voteId,
    decisionId: document.decisionId,
    initiativeId: document.initiativeId,
    participantId: document.participantId,
    choice: document.choice,
    transparencyCohort: document.transparencyCohort,
    castAt: document.castAt,
    updatedAt: document.updatedAt,
    version: document.version,
  };
}

/**
 * Strips persistence-only fields (`initiativeId`) to produce the exact
 * externally visible `InitiativeDecisionVote` shape the pre-existing routes
 * and aggregate calculations already depend on (Part 17 compatibility).
 */
export function toVoteResponse(record: InitiativeDecisionVoteMongoRecord): InitiativeDecisionVote {
  return {
    voteId: record.voteId,
    decisionId: record.decisionId,
    participantId: record.participantId,
    choice: record.choice,
    transparencyCohort: record.transparencyCohort,
    castAt: record.castAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

/**
 * Deterministic, natural-key-derived Vote identity (Recovery Task 31 Part 3,
 * Option A): stable across retries and concurrent first-cast attempts, safe
 * as a Mongo unique-indexed field, carries no timestamp/randomness, and does
 * not depend on `choice`. Mirrors the precedent already established for
 * Petition Signature's `signature-${petitionId}-${participantId}`.
 */
export function buildInitiativeDecisionVoteId(
  decisionId: string,
  participantId: string,
): InitiativeDecisionVoteId {
  return `initiative-decision-vote:${decisionId}:${participantId}`;
}
