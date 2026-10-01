export class DirectConversationCallValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectConversationCallValidationError";
  }
}

export class DirectConversationCallNotFoundError extends Error {
  constructor(message = "Call not found.") {
    super(message);
    this.name = "DirectConversationCallNotFoundError";
  }
}

export class DirectConversationCallConflictError extends Error {
  constructor(message = "A call is already in progress for this conversation.") {
    super(message);
    this.name = "DirectConversationCallConflictError";
  }
}

export class DirectConversationCallTransitionError extends Error {
  constructor(message = "This call cannot be changed that way.") {
    super(message);
    this.name = "DirectConversationCallTransitionError";
  }
}

export class DirectConversationCallExpiredError extends Error {
  constructor(message = "This invitation has expired.") {
    super(message);
    this.name = "DirectConversationCallExpiredError";
  }
}

export class DirectConversationCallRateLimitError extends Error {
  constructor(message = "Too many call invitations. Please try again later.") {
    super(message);
    this.name = "DirectConversationCallRateLimitError";
  }
}

export class DirectConversationCallPersistenceUnavailableError extends Error {
  constructor(message = "Call persistence is unavailable. MongoDB is required.") {
    super(message);
    this.name = "DirectConversationCallPersistenceUnavailableError";
  }
}

export class DirectConversationCallPersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "DirectConversationCallPersistenceError";
  }
}
