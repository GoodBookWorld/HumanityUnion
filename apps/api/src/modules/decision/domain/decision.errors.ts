export class DecisionValidationError extends Error {
  readonly code = "DECISION_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "DecisionValidationError";
  }
}

export class DecisionMemberNotRegisteredError extends Error {
  readonly code = "DECISION_MEMBER_NOT_REGISTERED";

  constructor(message = "Registered Member is required to create a Decision.") {
    super(message);
    this.name = "DecisionMemberNotRegisteredError";
  }
}

export class DecisionProposalNotFoundError extends Error {
  readonly code = "DECISION_PROPOSAL_NOT_FOUND";

  constructor(message = "Proposal not found.") {
    super(message);
    this.name = "DecisionProposalNotFoundError";
  }
}

export class DecisionProposalNotSubmittedError extends Error {
  readonly code = "DECISION_PROPOSAL_NOT_SUBMITTED";

  constructor(message = "Decision can only be created for a submitted Proposal.") {
    super(message);
    this.name = "DecisionProposalNotSubmittedError";
  }
}

export class DecisionAlreadyExistsError extends Error {
  readonly code = "DECISION_ALREADY_EXISTS";

  constructor(message = "A Decision already exists for this Proposal.") {
    super(message);
    this.name = "DecisionAlreadyExistsError";
  }
}

export class DecisionCreationForbiddenError extends Error {
  readonly code = "DECISION_CREATION_FORBIDDEN";

  constructor(message = "Only the Proposal creator may create a Decision for this Proposal.") {
    super(message);
    this.name = "DecisionCreationForbiddenError";
  }
}

export class DecisionNotFoundError extends Error {
  readonly code = "DECISION_NOT_FOUND";

  constructor(message = "Decision not found.") {
    super(message);
    this.name = "DecisionNotFoundError";
  }
}

export class DecisionForbiddenError extends Error {
  readonly code = "DECISION_FORBIDDEN";

  constructor(message = "You are not authorized to access this Decision.") {
    super(message);
    this.name = "DecisionForbiddenError";
  }
}

export class DecisionPersistenceError extends Error {
  readonly code = "DECISION_PERSISTENCE_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DecisionPersistenceError";
  }
}

export class DecisionTransactionError extends Error {
  readonly code = "DECISION_TRANSACTION_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DecisionTransactionError";
  }
}
