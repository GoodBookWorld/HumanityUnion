import type { Document } from "mongodb";

import type {
  InitiativeCollectiveDecisionId,
  InitiativeDecisionVote,
  InitiativeDecisionVoteChoiceExtended,
  InitiativeDecisionVoteId,
  ParticipationTransparencyCohort,
  PublicChoiceVoterCategory,
} from "@hu/types";
import {
  assertDecisionVoteVoterIdentity,
  INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED,
} from "@hu/types";

import { InitiativeDecisionVotePersistenceError } from "../initiative-decision-vote.errors.js";

const VALID_CHOICES = new Set<string>(INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED);
const VALID_COHORTS = new Set<ParticipationTransparencyCohort>(["verified", "unverified"]);
const VALID_VOTER_CATEGORIES = new Set<PublicChoiceVoterCategory>([
  "visitor",
  "participant",
  "member",
]);

/**
 * Authoritative Mongo document for `initiative_decision_votes`.
 * Pack 02B — XOR voter identity (participantId | visitorKey) and SELECT_ONE
 * candidateId on the same Decision Vote collection (no parallel engine).
 *
 * Legacy STANDARD rows remain participant-only ternary votes.
 */
export interface InitiativeDecisionVoteMongoDocument extends Document {
  voteId: InitiativeDecisionVoteId;
  decisionId: InitiativeCollectiveDecisionId;
  initiativeId: string;
  participantId?: string;
  visitorKey?: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
  voterCategory?: PublicChoiceVoterCategory;
  transparencyCohort: ParticipationTransparencyCohort;
  castAt: string;
  updatedAt: string;
  version: number;
}

export type InitiativeDecisionVoteMongoRecord = InitiativeDecisionVote & {
  initiativeId: string;
};

function assertPersistedChoice(
  choice: unknown,
  voteId: string,
): InitiativeDecisionVoteChoiceExtended {
  if (typeof choice === "string" && VALID_CHOICES.has(choice)) {
    return choice as InitiativeDecisionVoteChoiceExtended;
  }

  throw new InitiativeDecisionVotePersistenceError(
    `Persisted Initiative Decision Vote "${voteId}" has an invalid choice.`,
  );
}

export function toInitiativeDecisionVoteMongoDocument(
  record: InitiativeDecisionVoteMongoRecord,
): InitiativeDecisionVoteMongoDocument {
  assertDecisionVoteVoterIdentity(record);

  const document: InitiativeDecisionVoteMongoDocument = {
    voteId: record.voteId,
    decisionId: record.decisionId,
    initiativeId: record.initiativeId,
    choice: assertPersistedChoice(record.choice, record.voteId),
    transparencyCohort: record.transparencyCohort,
    castAt: record.castAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };

  if (record.participantId) {
    document.participantId = record.participantId;
  }
  if (record.visitorKey) {
    document.visitorKey = record.visitorKey;
  }
  if (record.candidateId) {
    document.candidateId = record.candidateId;
  }
  if (record.voterCategory) {
    document.voterCategory = record.voterCategory;
  }

  return document;
}

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

  const participantId =
    typeof document.participantId === "string" && document.participantId.length > 0
      ? document.participantId
      : undefined;
  const visitorKey =
    typeof document.visitorKey === "string" && document.visitorKey.length > 0
      ? document.visitorKey
      : undefined;

  try {
    assertDecisionVoteVoterIdentity({ participantId, visitorKey });
  } catch {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" must have exactly one of participantId or visitorKey.`,
    );
  }

  const choice = assertPersistedChoice(document.choice, document.voteId);

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

  if (
    typeof document.version !== "number" ||
    !Number.isInteger(document.version) ||
    document.version < 1
  ) {
    throw new InitiativeDecisionVotePersistenceError(
      `Persisted Initiative Decision Vote "${document.voteId}" has an invalid version.`,
    );
  }

  const candidateId =
    typeof document.candidateId === "string" && document.candidateId.length > 0
      ? document.candidateId
      : undefined;

  const voterCategory =
    document.voterCategory && VALID_VOTER_CATEGORIES.has(document.voterCategory)
      ? document.voterCategory
      : undefined;

  return {
    voteId: document.voteId,
    decisionId: document.decisionId,
    initiativeId: document.initiativeId,
    participantId,
    visitorKey,
    choice,
    candidateId,
    voterCategory,
    transparencyCohort: document.transparencyCohort,
    castAt: document.castAt,
    updatedAt: document.updatedAt,
    version: document.version,
  };
}

export function toVoteResponse(record: InitiativeDecisionVoteMongoRecord): InitiativeDecisionVote {
  return {
    voteId: record.voteId,
    decisionId: record.decisionId,
    participantId: record.participantId,
    visitorKey: record.visitorKey,
    choice: record.choice,
    candidateId: record.candidateId,
    voterCategory: record.voterCategory,
    transparencyCohort: record.transparencyCohort,
    castAt: record.castAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

/**
 * Deterministic Vote identity.
 * Participant path preserves Recovery Task 31 IDs for existing STANDARD rows:
 *   initiative-decision-vote:${decisionId}:${participantId}
 * Visitor path (Pack 02B):
 *   initiative-decision-vote:${decisionId}:visitor:${visitorKey}
 */
export function buildInitiativeDecisionVoteId(
  decisionId: string,
  participantId: string,
): InitiativeDecisionVoteId {
  return `initiative-decision-vote:${decisionId}:${participantId}`;
}

export function buildInitiativeDecisionVoteIdForVisitor(
  decisionId: string,
  visitorKey: string,
): InitiativeDecisionVoteId {
  return `initiative-decision-vote:${decisionId}:visitor:${visitorKey}`;
}

export function buildInitiativeDecisionVoteIdForVoter(input: {
  decisionId: string;
  participantId?: string;
  visitorKey?: string;
}): InitiativeDecisionVoteId {
  assertDecisionVoteVoterIdentity(input);
  if (input.participantId) {
    return buildInitiativeDecisionVoteId(input.decisionId, input.participantId);
  }

  return buildInitiativeDecisionVoteIdForVisitor(input.decisionId, input.visitorKey!);
}
