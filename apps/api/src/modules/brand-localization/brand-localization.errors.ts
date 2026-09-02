export class BrandLocalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandLocalizationError";
  }
}

export class BrandLocalizationValidationError extends BrandLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "BrandLocalizationValidationError";
  }
}

export class BrandLocalizationConflictError extends BrandLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "BrandLocalizationConflictError";
  }
}

export class BrandLocalizationNotFoundError extends BrandLocalizationError {
  constructor(message: string) {
    super(message);
    this.name = "BrandLocalizationNotFoundError";
  }
}

export class BrandLocalizationPersistenceError extends BrandLocalizationError {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "BrandLocalizationPersistenceError";
    this.cause = cause;
  }
}
