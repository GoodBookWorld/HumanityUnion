/** Communication UX Pack 03.7 — narrow error types for the Shared Documents module. */

export class SharedDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedDocumentValidationError";
  }
}

/** Part 5 — a distinct name from `SharedDocumentValidationError` so routes can report a dedicated, non-accusatory message. */
export class SharedDocumentMalwareDetectedError extends Error {
  constructor(message = "This file could not be verified as safe and was not stored.") {
    super(message);
    this.name = "SharedDocumentMalwareDetectedError";
  }
}

/** Part 4/7/8 — Direct Conversation / Collaboration Channel / Collaboration Session not found; resolves to the same generic 404 as `AccessDeniedError` (see routes) so existence is never leaked. */
export class SharedDocumentContextNotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "SharedDocumentContextNotFoundError";
  }
}

/** Part 7 — Only participants/Author/Active Allies; guests are always denied. */
export class SharedDocumentAccessDeniedError extends Error {
  constructor(message = "You do not have access to this document.") {
    super(message);
    this.name = "SharedDocumentAccessDeniedError";
  }
}

export class SharedDocumentNotFoundError extends Error {
  constructor(message = "Document not found.") {
    super(message);
    this.name = "SharedDocumentNotFoundError";
  }
}

/** Part 9 — only the uploader of a document family may replace/remove it. */
export class SharedDocumentManagerOnlyError extends Error {
  constructor(message = "Only the Participant who uploaded this document may manage it.") {
    super(message);
    this.name = "SharedDocumentManagerOnlyError";
  }
}

export class SharedDocumentPersistenceError extends Error {
  readonly code = "SHARED_DOCUMENT_PERSISTENCE_ERROR";

  constructor(message = "Shared Document persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "SharedDocumentPersistenceError";
  }
}

export class SharedDocumentPersistenceUnavailableError extends SharedDocumentPersistenceError {
  constructor() {
    super("Shared Document persistence is not configured.");
    this.name = "SharedDocumentPersistenceUnavailableError";
  }
}
