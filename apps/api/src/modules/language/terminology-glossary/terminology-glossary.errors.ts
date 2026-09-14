export class TerminologyGlossaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerminologyGlossaryError";
  }
}

export class TerminologyGlossaryValidationError extends TerminologyGlossaryError {
  constructor(message: string) {
    super(message);
    this.name = "TerminologyGlossaryValidationError";
  }
}

export class TerminologyGlossaryConflictError extends TerminologyGlossaryError {
  constructor(message: string) {
    super(message);
    this.name = "TerminologyGlossaryConflictError";
  }
}

export class TerminologyGlossaryNotFoundError extends TerminologyGlossaryError {
  constructor(message: string) {
    super(message);
    this.name = "TerminologyGlossaryNotFoundError";
  }
}

export class TerminologyGlossaryPersistenceError extends TerminologyGlossaryError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "TerminologyGlossaryPersistenceError";
    this.cause = cause;
  }
}
