export class ActivityValidationError extends Error {
  readonly code = "ACTIVITY_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ActivityValidationError";
  }
}

export class ActivityMemberNotRegisteredError extends Error {
  readonly code = "ACTIVITY_MEMBER_NOT_REGISTERED";

  constructor(message = "Registered Member is required to create an Activity.") {
    super(message);
    this.name = "ActivityMemberNotRegisteredError";
  }
}

export class ActivityNotFoundError extends Error {
  readonly code = "ACTIVITY_NOT_FOUND";

  constructor(message = "Activity not found.") {
    super(message);
    this.name = "ActivityNotFoundError";
  }
}

export class ActivityForbiddenError extends Error {
  readonly code = "ACTIVITY_FORBIDDEN";

  constructor(message = "You do not have access to this Activity.") {
    super(message);
    this.name = "ActivityForbiddenError";
  }
}

export class ActivityPersistenceError extends Error {
  readonly code = "ACTIVITY_PERSISTENCE_ERROR";

  constructor(message = "Activity persistence failed.", readonly causeError?: unknown) {
    super(message);
    this.name = "ActivityPersistenceError";
  }
}

export class ActivityTransactionError extends Error {
  readonly code = "ACTIVITY_TRANSACTION_FAILED";

  constructor(message = "Activity transaction failed.", readonly causeError?: unknown) {
    super(message);
    this.name = "ActivityTransactionError";
  }
}
