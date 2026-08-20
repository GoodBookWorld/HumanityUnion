import type { Document } from "mongodb";

import type {
  InitiativeDecisionVoteChoiceExtended,
  InitiativeDecisionVoteHistoryEntry,
  ParticipationTransparencyCohort,
  PublicChoiceVoterCategory,
} from "@hu/types";
import { INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED } from "@hu/types";

import { InitiativeDecisionVotePersistenceError } from "../initiative-decision-vote.errors.js";

const VALID_CHOICES = new Set<string>(INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED);
const VALID_COHORTS = new Set<ParticipationTransparencyCohort>(["verified", "unverified"]);

/**
 * Authoritative Mongo document for append-only
 * `initiative_decision_vote_history` (Recovery Task 31 Part 5/6).
 * Pack 02B — optional visitorKey + candidate fields; never updated.
 */
export interface InitiativeDecisionVoteHistoryMongoDocument extends Document {
  historyId: string;
  voteId: string;
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
  previousChoice?: InitiativeDecisionVoteChoiceExtended;
  previousCandidateId?: string;
  newChoice: InitiativeDecisionVoteChoiceExtended;
  newCandidateId?: string;
  changedAt: string;
  transparencyCohort: ParticipationTransparencyCohort;
  voterCategory?: PublicChoiceVoterCategory;
}

function assertHistoryChoice(
  choice: unknown,
  historyId: string,
  field: string,
): InitiativeDecisionVoteChoiceExtended {
  if (typeof choice === "string" && VALID_CHOICES.has(choice)) {
    return choice as InitiativeDecisionVoteChoiceExtended;
  }

  throw new InitiativeDecisionVotePersistenceError(
    `Persisted history entry "${historyId}" has an invalid ${field}.`,
  );
}

export function toInitiativeDecisionVoteHistoryMongoDocument(
  entry: InitiativeDecisionVoteHistoryEntry,
): InitiativeDecisionVoteHistoryMongoDocument {
  const hasParticipant = Boolean(entry.participantId?.trim());
  const hasVisitor = Boolean(entry.visitorKey?.trim());
  if (hasParticipant === hasVisitor) {
    throw new InitiativeDecisionVotePersistenceError(
      `Mongo Initiative Decision Vote History "${entry.historyId}" requires exactly one of participantId or visitorKey.`,
    );
  }

  const document: InitiativeDecisionVoteHistoryMongoDocument = {
    historyId: entry.historyId,
    voteId: entry.voteId,
    decisionId: entry.decisionId,
    newChoice: assertHistoryChoice(entry.newChoice, entry.historyId, "newChoice"),
    changedAt: entry.changedAt,
    transparencyCohort: entry.transparencyCohort,
  };

  if (entry.participantId) {
    document.participantId = entry.participantId;
  }
  if (entry.visitorKey) {
    document.visitorKey = entry.visitorKey;
  }
  if (entry.previousChoice !== undefined) {
    document.previousChoice = assertHistoryChoice(
      entry.previousChoice,
      entry.historyId,
      "previousChoice",
    );
  }
  if (entry.previousCandidateId) {
    document.previousCandidateId = entry.previousCandidateId;
  }
  if (entry.newCandidateId) {
    document.newCandidateId = entry.newCandidateId;
  }
  if (entry.voterCategory) {
    document.voterCategory = entry.voterCategory;
  }

  return document;
}

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

  const participantId =
    typeof document.participantId === "string" && document.participantId.length > 0
      ? document.participantId
      : undefined;
  const visitorKey =
    typeof document.visitorKey === "string" && document.visitorKey.length > 0
      ? document.visitorKey
      : undefined;

  if (Boolean(participantId) === Boolean(visitorKey)) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted history entry "${document.historyId}" must have exactly one of participantId or visitorKey.`,
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

  const newChoice = assertHistoryChoice(document.newChoice, document.historyId, "newChoice");

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
    participantId,
    visitorKey,
    previousChoice: document.previousChoice ?? undefined,
    previousCandidateId: document.previousCandidateId,
    newChoice,
    newCandidateId: document.newCandidateId,
    changedAt: document.changedAt,
    transparencyCohort: document.transparencyCohort,
    voterCategory: document.voterCategory,
  };
}

/**
 * Deterministic history identity. Participant path preserves Task 31 IDs.
 * Visitor path uses visitorKey segment.
 */
export function buildInitiativeDecisionVoteHistoryId(
  decisionId: string,
  participantId: string,
  newVersion: number,
): string {
  return `initiative-decision-vote-history:${decisionId}:${participantId}:${newVersion}`;
}

export function buildInitiativeDecisionVoteHistoryIdForVisitor(
  decisionId: string,
  visitorKey: string,
  newVersion: number,
): string {
  return `initiative-decision-vote-history:${decisionId}:visitor:${visitorKey}:${newVersion}`;
}

export function buildInitiativeDecisionVoteHistoryIdForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
  newVersion: number;
}): string {
  if (input.participantId) {
    return buildInitiativeDecisionVoteHistoryId(
      input.decisionId,
      input.participantId,
      input.newVersion,
    );
  }

  if (!input.visitorKey) {
    throw new InitiativeDecisionVotePersistenceError(
      "History identity requires participantId or visitorKey.",
    );
  }

  return buildInitiativeDecisionVoteHistoryIdForVisitor(
    input.decisionId,
    input.visitorKey,
    input.newVersion,
  );
}
