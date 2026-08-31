export class LanguageRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LanguageRegistryError";
  }
}

export class LanguageRegistryValidationError extends LanguageRegistryError {
  constructor(message: string) {
    super(message);
    this.name = "LanguageRegistryValidationError";
  }
}

export class LanguageRegistryConflictError extends LanguageRegistryError {
  constructor(message: string) {
    super(message);
    this.name = "LanguageRegistryConflictError";
  }
}

export class LanguageRegistryNotFoundError extends LanguageRegistryError {
  constructor(message: string) {
    super(message);
    this.name = "LanguageRegistryNotFoundError";
  }
}

export class LanguageRegistryPersistenceError extends LanguageRegistryError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LanguageRegistryPersistenceError";
    this.cause = cause;
  }
}
