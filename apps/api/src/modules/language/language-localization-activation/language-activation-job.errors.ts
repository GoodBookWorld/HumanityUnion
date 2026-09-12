export class LanguageActivationJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguageActivationJobError";
  }
}

export class LanguageActivationJobValidationError extends LanguageActivationJobError {
  constructor(message: string) {
    super(message);
    this.name = "LanguageActivationJobValidationError";
  }
}

export class LanguageActivationJobNotFoundError extends LanguageActivationJobError {
  constructor(message: string) {
    super(message);
    this.name = "LanguageActivationJobNotFoundError";
  }
}

export class LanguageActivationJobPersistenceError extends LanguageActivationJobError {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "LanguageActivationJobPersistenceError";
  }
}
