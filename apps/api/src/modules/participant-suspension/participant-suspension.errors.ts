export class ParticipantSuspensionAdminRequiredError extends Error {
  constructor(message = "Administrator access is required.") {
    super(message);
    this.name = "ParticipantSuspensionAdminRequiredError";
  }
}

export class ParticipantSuspensionUnauthorizedError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "ParticipantSuspensionUnauthorizedError";
  }
}

export class ParticipantSuspensionNotFoundError extends Error {
  constructor(message = "Participant not found.") {
    super(message);
    this.name = "ParticipantSuspensionNotFoundError";
  }
}

export class ParticipantSuspensionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipantSuspensionValidationError";
  }
}

export class ParticipantSuspensionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipantSuspensionConflictError";
  }
}

export class ParticipantSuspensionReviewInvalidError extends Error {
  constructor(message = "This suspension review link is invalid or has expired.") {
    super(message);
    this.name = "ParticipantSuspensionReviewInvalidError";
  }
}

export class ParticipantSuspensionRateLimitError extends Error {
  constructor(message = "Too many review requests. Please try again later.") {
    super(message);
    this.name = "ParticipantSuspensionRateLimitError";
  }
}
