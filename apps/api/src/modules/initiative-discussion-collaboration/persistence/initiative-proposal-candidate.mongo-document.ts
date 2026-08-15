import type { Document } from "mongodb";

import type { InitiativeDiscussionProposalCandidate } from "@hu/types";

import { InitiativeDiscussionProposalCandidatePersistenceError } from "../initiative-discussion-collaboration.errors.js";

/**
 * Authoritative Mongo document for the
 * `initiative_discussion_proposal_candidates` collection (UX Evolution Pack
 * 02.1). Immutable after creation — there is no update path, matching the
 * pre-existing in-memory contract (Part 6: "at most one candidate exists
 * per sourceCommentId").
 */
export interface InitiativeDiscussionProposalCandidateMongoDocument extends Document {
  candidateId: string;
  initiativeId: string;
  sourceCommentId: string;
  sourceParticipantId: string;
  creatorParticipantId: string;
  commentText: string;
  status: "candidate";
  createdAt: string;
}

export function toInitiativeDiscussionProposalCandidateMongoDocument(
  record: InitiativeDiscussionProposalCandidate,
): InitiativeDiscussionProposalCandidateMongoDocument {
  return {
    candidateId: record.candidateId,
    initiativeId: record.initiativeId,
    sourceCommentId: record.sourceCommentId,
    sourceParticipantId: record.sourceParticipantId,
    creatorParticipantId: record.creatorParticipantId,
    commentText: record.commentText,
    status: record.status,
    createdAt: record.createdAt,
  };
}

/**
 * Rejects malformed persisted Proposal Candidate documents rather than
 * silently coercing them, mirroring
 * `fromInitiativeDecisionVoteMongoDocument`.
 */
export function fromInitiativeDiscussionProposalCandidateMongoDocument(
  document: InitiativeDiscussionProposalCandidateMongoDocument,
): InitiativeDiscussionProposalCandidate {
  if (typeof document.candidateId !== "string" || document.candidateId.length === 0) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      "Persisted Proposal Candidate is missing a valid candidateId.",
    );
  }

  if (typeof document.initiativeId !== "string" || document.initiativeId.length === 0) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" is missing a valid initiativeId.`,
    );
  }

  if (typeof document.sourceCommentId !== "string" || document.sourceCommentId.length === 0) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" is missing a valid sourceCommentId.`,
    );
  }

  if (typeof document.sourceParticipantId !== "string" || document.sourceParticipantId.length === 0) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" is missing a valid sourceParticipantId.`,
    );
  }

  if (typeof document.creatorParticipantId !== "string" || document.creatorParticipantId.length === 0) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" is missing a valid creatorParticipantId.`,
    );
  }

  if (typeof document.commentText !== "string") {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" is missing valid commentText.`,
    );
  }

  if (document.status !== "candidate") {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" has an invalid status.`,
    );
  }

  if (typeof document.createdAt !== "string" || Number.isNaN(Date.parse(document.createdAt))) {
    throw new InitiativeDiscussionProposalCandidatePersistenceError(
      `Persisted Proposal Candidate "${document.candidateId}" has an invalid createdAt.`,
    );
  }

  return {
    candidateId: document.candidateId,
    initiativeId: document.initiativeId,
    sourceCommentId: document.sourceCommentId,
    sourceParticipantId: document.sourceParticipantId,
    creatorParticipantId: document.creatorParticipantId,
    commentText: document.commentText,
    status: document.status,
    createdAt: document.createdAt,
  };
}
