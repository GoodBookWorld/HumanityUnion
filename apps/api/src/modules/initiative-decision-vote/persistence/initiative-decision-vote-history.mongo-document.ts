import type { Document } from "mongodb";

import type {
  InitiativeDecisionVoteChoice,
  InitiativeDecisionVoteHistoryEntry,
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
 * Authoritative Mongo document for the append-only
 * `initiative_decision_vote_history` collection (Recovery Task 31 Part 5/6).
 * One immutable row per cast/change; never updated or deleted by production
 * code (only narrow `ForTests` cleanup helpers may remove rows).
 */
export interface InitiativeDecisionVoteHistoryMongoDocument extends Document {
  historyId: string;
  voteId: string;
  decisionId: string;
  participantId: string;
  previousChoice?: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  changedAt: string;
  transparencyCohort: ParticipationTransparencyCohort;
}

export function toInitiativeDecisionVoteHistoryMongoDocument(
  entry: InitiativeDecisionVoteHistoryEntry,
): InitiativeDecisionVoteHistoryMongoDocument {
  return {
    historyId: entry.historyId,
    voteId: entry.voteId,
    decisionId: entry.decisionId,
    participantId: entry.participantId,
    previousChoice: entry.previousChoice,
    newChoice: entry.newChoice,
    changedAt: entry.changedAt,
    transparencyCohort: entry.transparencyCohort,
  };
}

/** Rejects malformed persisted history documents rather than coercing them (Part 6). */
export function fromInitiativeDecisionVoteHistoryMongoDocument(
  document: InitiativeDecisionVoteHistoryMongoDocument,
): InitiativeDecisionVoteHistoryEntry {
  if (typeof document.historyId !== "string" || document.historyId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      "Persisted Initiative Decision Vote History entry is missing a valid historyId.",
    );
  }

  if (typeof document.voteId !== "string" || document.voteId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" is missing a valid voteId.`,
    );
  }

  if (typeof document.decisionId !== "string" || document.decisionId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" is missing a valid decisionId.`,
    );
  }

  if (typeof document.participantId !== "string" || document.participantId.length === 0) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" is missing a valid participantId.`,
    );
  }

  if (
    document.previousChoice !== undefined &&
    document.previousChoice !== null &&
    !VALID_CHOICES.has(document.previousChoice)
  ) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" has an invalid previousChoice.`,
    );
  }

  if (!VALID_CHOICES.has(document.newChoice)) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" has an invalid newChoice.`,
    );
  }

  if (typeof document.changedAt !== "string" || Number.isNaN(Date.parse(document.changedAt))) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" has an invalid changedAt.`,
    );
  }

  if (!VALID_COHORTS.has(document.transparencyCohort)) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" has an invalid transparencyCohort.`,
    );
  }

  return {
    historyId: document.historyId,
    voteId: document.voteId,
    decisionId: document.decisionId,
    participantId: document.participantId,
    previousChoice: document.previousChoice ?? undefined,
    newChoice: document.newChoice,
    changedAt: document.changedAt,
    transparencyCohort: document.transparencyCohort,
  };
}

/**
 * Deterministic history identity (Part 5 "deterministic history identity
 * where practical"): keyed off the same natural key as the Vote itself plus
 * the new version being recorded. Since `version` increments by exactly one
 * per committed transition, this is collision-free across a Vote's
 * lifetime and stable across a transaction retry of the same logical
 * transition (unlike the prior `vote-history-${Date.now()}-${random}` id).
 */
export function buildInitiativeDecisionVoteHistoryId(
  decisionId: string,
  participantId: string,
  newVersion: number,
): string {
  return `initiative-decision-vote-history:${decisionId}:${participantId}:${newVersion}`;
}
