export class LegalLocalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalLocalizationError";
  }
}

export class LegalLocalizationValidationError extends LegalLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "LegalLocalizationValidationError";
  }
}

export class LegalLocalizationConflictError extends LegalLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "LegalLocalizationConflictError";
  }
}

export class LegalLocalizationNotFoundError extends LegalLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "LegalLocalizationNotFoundError";
  }
}

export class LegalLocalizationPersistenceError extends LegalLocalizationError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LegalLocalizationPersistenceError";
    this.cause = cause;
  }
}
