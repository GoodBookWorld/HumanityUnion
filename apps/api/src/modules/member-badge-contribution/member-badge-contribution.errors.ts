export class MemberBadgeContributionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeContributionValidationError";
  }
}

export class MemberBadgeContributionAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeContributionAccessDeniedError";
  }
}

export class MemberBadgeContributionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeContributionConflictError";
  }
}

export class MemberBadgeContributionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeContributionNotFoundError";
  }
}

export class MemberBadgeContributionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberBadgeContributionUnavailableError";
  }
}
