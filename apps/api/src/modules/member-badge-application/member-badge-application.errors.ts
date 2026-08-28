export class MemberBadgeApplicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeApplicationValidationError";
  }
}

export class MemberBadgeApplicationAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeApplicationAccessDeniedError";
  }
}

export class MemberBadgeApplicationNotFoundError extends Error {
  constructor(message = "Member Badge Application not found.") {
    super(message);
    this.name = "MemberBadgeApplicationNotFoundError";
  }
}

export class MemberBadgeApplicationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeApplicationConflictError";
  }
}

export class MemberBadgeApplicationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeApplicationUnavailableError";
  }
}
