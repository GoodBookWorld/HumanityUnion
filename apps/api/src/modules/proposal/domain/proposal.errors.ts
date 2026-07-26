export class ProposalValidationError extends Error {
  readonly code = "PROPOSAL_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ProposalValidationError";
  }
}

export class ProposalMemberNotRegisteredError extends Error {
  readonly code = "PROPOSAL_MEMBER_NOT_REGISTERED";

  constructor(message = "Registered Member is required to create a Proposal.") {
    super(message);
    this.name = "ProposalMemberNotRegisteredError";
  }
}

export class ProposalActivityNotFoundError extends Error {
  readonly code = "PROPOSAL_ACTIVITY_NOT_FOUND";

  constructor(message = "Activity not found.") {
    super(message);
    this.name = "ProposalActivityNotFoundError";
  }
}

export class ProposalDiscussionNotFoundError extends Error {
  readonly code = "PROPOSAL_DISCUSSION_NOT_FOUND";

  constructor(message = "Discussion not found.") {
    super(message);
    this.name = "ProposalDiscussionNotFoundError";
  }
}

export class ProposalDiscussionActivityMismatchError extends Error {
  readonly code = "PROPOSAL_DISCUSSION_ACTIVITY_MISMATCH";

  constructor(message = "Discussion does not belong to the specified Activity.") {
    super(message);
    this.name = "ProposalDiscussionActivityMismatchError";
  }
}

export class ProposalNotFoundError extends Error {
  readonly code = "PROPOSAL_NOT_FOUND";

  constructor(message = "Proposal not found.") {
    super(message);
    this.name = "ProposalNotFoundError";
  }
}

export class ProposalForbiddenError extends Error {
  readonly code = "PROPOSAL_FORBIDDEN";

  constructor(message = "You are not authorized to access this Proposal.") {
    super(message);
    this.name = "ProposalForbiddenError";
  }
}

export class ProposalPersistenceError extends Error {
  readonly code = "PROPOSAL_PERSISTENCE_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ProposalPersistenceError";
  }
}

export class ProposalTransactionError extends Error {
  readonly code = "PROPOSAL_TRANSACTION_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ProposalTransactionError";
  }
}

export class ProposalSubmissionForbiddenError extends Error {
  readonly code = "PROPOSAL_SUBMISSION_FORBIDDEN";

  constructor(message = "Only the Proposal creator may submit this Proposal.") {
    super(message);
    this.name = "ProposalSubmissionForbiddenError";
  }
}

export class ProposalAlreadySubmittedError extends Error {
  readonly code = "PROPOSAL_ALREADY_SUBMITTED";

  constructor(message = "Proposal has already been submitted.") {
    super(message);
    this.name = "ProposalAlreadySubmittedError";
  }
}

export class InvalidProposalStateTransitionError extends Error {
  readonly code = "INVALID_PROPOSAL_STATE_TRANSITION";

  constructor(message = "Proposal cannot transition to submitted from its current state.") {
    super(message);
    this.name = "InvalidProposalStateTransitionError";
  }
}

export class ProposalSubmissionValidationError extends Error {
  readonly code = "PROPOSAL_SUBMISSION_VALIDATION_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ProposalSubmissionValidationError";
  }
}

export class ProposalConcurrencyConflictError extends Error {
  readonly code = "PROPOSAL_CONCURRENCY_CONFLICT";

  constructor(message = "Proposal submission conflicted with a concurrent update.") {
    super(message);
    this.name = "ProposalConcurrencyConflictError";
  }
}
