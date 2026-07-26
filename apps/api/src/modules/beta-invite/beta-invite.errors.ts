export class BetaInviteNotFoundError extends Error {
  constructor(
    message = "Registration is not available right now. Please contact your beta coordinator.",
  ) {
    super(message);
    this.name = "BetaInviteNotFoundError";
  }
}

export class BetaInviteRequiredError extends Error {
  constructor(
    message = "Registration is not available right now. Please contact your beta coordinator.",
  ) {
    super(message);
    this.name = "BetaInviteRequiredError";
  }
}

export class BetaInviteAdminRequiredError extends Error {
  constructor(message = "Administrator access is required.") {
    super(message);
    this.name = "BetaInviteAdminRequiredError";
  }
}

export class BetaInviteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaInviteValidationError";
  }
}
