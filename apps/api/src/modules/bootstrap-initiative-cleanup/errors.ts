export class BootstrapInitiativeCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapInitiativeCleanupError";
  }
}

export class BootstrapInitiativeCleanupValidationError extends BootstrapInitiativeCleanupError {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapInitiativeCleanupValidationError";
  }
}

export class BootstrapInitiativeCleanupUnexpectedDataError extends BootstrapInitiativeCleanupError {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapInitiativeCleanupUnexpectedDataError";
  }
}
