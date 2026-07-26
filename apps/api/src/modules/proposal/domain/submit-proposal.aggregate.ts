import {
  InvalidProposalStateTransitionError,
  ProposalAlreadySubmittedError,
  ProposalSubmissionValidationError,
} from "./proposal.errors.js";
import type { ProposalRecord } from "./proposal.types.js";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const SUMMARY_MIN_LENGTH = 10;
const SUMMARY_MAX_LENGTH = 500;
const PROPOSAL_TEXT_MIN_LENGTH = 10;
const PROPOSAL_TEXT_MAX_LENGTH = 10000;

export function validateProposalSubmissionReadiness(proposal: ProposalRecord): void {
  if (proposal.title.length < TITLE_MIN_LENGTH || proposal.title.length > TITLE_MAX_LENGTH) {
    throw new ProposalSubmissionValidationError(
      `title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    );
  }

  if (proposal.summary.length < SUMMARY_MIN_LENGTH || proposal.summary.length > SUMMARY_MAX_LENGTH) {
    throw new ProposalSubmissionValidationError(
      `summary must be between ${SUMMARY_MIN_LENGTH} and ${SUMMARY_MAX_LENGTH} characters.`,
    );
  }

  if (
    proposal.proposalText.length < PROPOSAL_TEXT_MIN_LENGTH ||
    proposal.proposalText.length > PROPOSAL_TEXT_MAX_LENGTH
  ) {
    throw new ProposalSubmissionValidationError(
      `proposalText must be between ${PROPOSAL_TEXT_MIN_LENGTH} and ${PROPOSAL_TEXT_MAX_LENGTH} characters.`,
    );
  }
}

export function applyProposalSubmissionTransition(
  proposal: ProposalRecord,
  occurredAt: string,
): ProposalRecord {
  if (proposal.status === "submitted") {
    throw new ProposalAlreadySubmittedError();
  }

  if (proposal.status !== "draft") {
    throw new InvalidProposalStateTransitionError();
  }

  validateProposalSubmissionReadiness(proposal);

  return {
    ...proposal,
    status: "submitted",
    aggregateVersion: proposal.aggregateVersion + 1,
    updatedAt: occurredAt,
  };
}
