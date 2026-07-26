export class DiscussionValidationError extends Error {
  readonly code = "DISCUSSION_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "DiscussionValidationError";
  }
}

export class DiscussionMemberNotRegisteredError extends Error {
  readonly code = "DISCUSSION_MEMBER_NOT_REGISTERED";

  constructor(message = "Registered Member is required to create a Discussion.") {
    super(message);
    this.name = "DiscussionMemberNotRegisteredError";
  }
}

export class DiscussionActivityNotFoundError extends Error {
  readonly code = "DISCUSSION_ACTIVITY_NOT_FOUND";

  constructor(message = "Activity was not found.") {
    super(message);
    this.name = "DiscussionActivityNotFoundError";
  }
}

export class DiscussionNotFoundError extends Error {
  readonly code = "DISCUSSION_NOT_FOUND";

  constructor(message = "Discussion was not found.") {
    super(message);
    this.name = "DiscussionNotFoundError";
  }
}

export class DiscussionForbiddenError extends Error {
  readonly code = "DISCUSSION_FORBIDDEN";

  constructor(message = "You are not authorized to access this Discussion.") {
    super(message);
    this.name = "DiscussionForbiddenError";
  }
}

export class DiscussionPersistenceError extends Error {
  readonly code = "DISCUSSION_PERSISTENCE_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DiscussionPersistenceError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class DiscussionTransactionError extends Error {
  readonly code = "DISCUSSION_TRANSACTION_ERROR";

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DiscussionTransactionError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
