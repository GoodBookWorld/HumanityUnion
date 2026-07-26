export { default as proposalRouter } from "./api/proposal.routes.js";
export { createProposal } from "./application/create-proposal.service.js";
export { getProposalByIdForMember } from "./application/proposal-query.service.js";
export { submitProposal } from "./application/submit-proposal.service.js";
export {
  buildProposalCreatedEventId,
  createProposalCreatedEvent,
  type ProposalCreatedPayload,
} from "./domain/proposal-created.event.js";
export {
  buildProposalSubmittedEventId,
  createProposalSubmittedEvent,
  type ProposalSubmittedPayload,
} from "./domain/proposal-submitted.event.js";
export { buildProposalAggregateForCreate } from "./domain/create-proposal.aggregate.js";
export { applyProposalSubmissionTransition } from "./domain/submit-proposal.aggregate.js";
export {
  InvalidProposalStateTransitionError,
  ProposalActivityNotFoundError,
  ProposalAlreadySubmittedError,
  ProposalConcurrencyConflictError,
  ProposalDiscussionActivityMismatchError,
  ProposalDiscussionNotFoundError,
  ProposalForbiddenError,
  ProposalMemberNotRegisteredError,
  ProposalNotFoundError,
  ProposalPersistenceError,
  ProposalSubmissionForbiddenError,
  ProposalSubmissionValidationError,
  ProposalTransactionError,
  ProposalValidationError,
} from "./domain/proposal.errors.js";
export type {
  CreateProposalCommandInput,
  CreateProposalResult,
  ProposalDetailDto,
  ProposalRecord,
  ProposalStatus,
  SubmitProposalCommandInput,
  SubmitProposalResult,
} from "./domain/proposal.types.js";
export {
  assertNoTrustedCreateProposalFields,
  assertNoTrustedSubmitProposalFields,
  validateCreateProposalInput,
  validateSubmitProposalCommand,
} from "./domain/proposal.validation.js";
export {
  countProposals,
  deleteProposalsByCreatorMemberIdPrefix,
  deleteProposalsByProposalIdPrefix,
  findProposalById,
  insertProposal,
  updateProposalForSubmission,
} from "./infrastructure/proposal.repository.js";
export {
  fromProposalMongoDocument,
  toProposalDetailDto,
  toProposalMongoDocument,
  type ProposalMongoDocument,
} from "./infrastructure/proposal.persistence.js";
