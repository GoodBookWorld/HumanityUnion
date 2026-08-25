export class SeoPageOverrideValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoPageOverrideValidationError";
  }
}

export class SeoPageOverrideNotFoundError extends Error {
  constructor(message = "SEO page override not found.") {
    super(message);
    this.name = "SeoPageOverrideNotFoundError";
  }
}

export class SeoPageOverridePersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SeoPageOverridePersistenceError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class SeoPageOverrideForbiddenTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoPageOverrideForbiddenTargetError";
  }
}
