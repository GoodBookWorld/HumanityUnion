export class MembershipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipValidationError";
  }
}

export class MembershipAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipAccessDeniedError";
  }
}

export class MembershipNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipNotFoundError";
  }
}

export class MembershipConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipConflictError";
  }
}

export class MembershipPersistenceUnavailableError extends Error {
  constructor(message = "Membership persistence is unavailable.") {
    super(message);
    this.name = "MembershipPersistenceUnavailableError";
  }
}
