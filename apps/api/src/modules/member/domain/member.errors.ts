export class MemberAlreadyRegisteredError extends Error {
  readonly code = "MEMBER_ALREADY_REGISTERED";

  constructor(readonly memberId: string) {
    super("Member is already registered.");
    this.name = "MemberAlreadyRegisteredError";
  }
}

export class MemberRegistrationConflictError extends Error {
  readonly code = "MEMBER_REGISTRATION_CONFLICT";

  constructor(message = "Member registration conflict.") {
    super(message);
    this.name = "MemberRegistrationConflictError";
  }
}

export class MemberRegistrationUnavailableError extends Error {
  readonly code = "MEMBER_REGISTRATION_UNAVAILABLE";

  constructor(message = "Member registration persistence is unavailable.") {
    super(message);
    this.name = "MemberRegistrationUnavailableError";
  }
}

export class MemberNotFoundError extends Error {
  readonly code = "MEMBER_NOT_FOUND";

  constructor(message = "Member not found.") {
    super(message);
    this.name = "MemberNotFoundError";
  }
}

export class MemberRegistrationTransactionError extends Error {
  readonly code = "MEMBER_REGISTRATION_TRANSACTION_FAILED";

  constructor(message: string, readonly causeError?: unknown) {
    super(message);
    this.name = "MemberRegistrationTransactionError";
  }
}
