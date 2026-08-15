import type { LifecycleSafetyDecision } from "@hu/types";

export class BlogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogValidationError";
  }
}

export class BlogAccessDeniedError extends Error {
  constructor(message = "You do not have permission to perform this Blog action.") {
    super(message);
    this.name = "BlogAccessDeniedError";
  }
}

export class BlogNotFoundError extends Error {
  constructor(message = "Blog post not found.") {
    super(message);
    this.name = "BlogNotFoundError";
  }
}

export class BlogConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogConflictError";
  }
}

export class BlogSafetyRejectedError extends Error {
  readonly decision: LifecycleSafetyDecision;

  constructor(decision: LifecycleSafetyDecision, message?: string) {
    super(message ?? decision.summary ?? "Blog content was rejected by Safety.");
    this.name = "BlogSafetyRejectedError";
    this.decision = decision;
  }
}

export class BlogSafetyNeedsReviewError extends Error {
  readonly decision: LifecycleSafetyDecision;

  constructor(decision: LifecycleSafetyDecision, message?: string) {
    super(message ?? decision.summary ?? "Blog content requires safety review.");
    this.name = "BlogSafetyNeedsReviewError";
    this.decision = decision;
  }
}

export class BlogPersistenceUnavailableError extends Error {
  constructor(message = "Blog persistence is unavailable. MongoDB is required.") {
    super(message);
    this.name = "BlogPersistenceUnavailableError";
  }
}

export class BlogPersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "BlogPersistenceError";
  }
}
