export class WebUiMessagePackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessagePackError";
  }
}

export class WebUiMessagePackValidationError extends WebUiMessagePackError {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessagePackValidationError";
  }
}

export class WebUiMessagePackNotFoundError extends WebUiMessagePackError {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessagePackNotFoundError";
  }
}

export class WebUiMessagePackPersistenceError extends WebUiMessagePackError {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "WebUiMessagePackPersistenceError";
  }
}

/**
 * Optimistic concurrency conflict — no write performed.
 * Admin routes map this to HTTP 409.
 */
export class WebUiMessagePackRevisionConflictError extends WebUiMessagePackError {
  constructor(message: string) {
    super(message);
    this.name = "WebUiMessagePackRevisionConflictError";
  }
}
