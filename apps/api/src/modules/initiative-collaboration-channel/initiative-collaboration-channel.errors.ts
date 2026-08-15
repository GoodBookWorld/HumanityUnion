/**
 * Communication UX Pack 03.5 — narrow error types for the Initiative
 * Collaboration Channel, mirroring the shape already established for
 * Direct Messaging (`direct-messaging.errors.ts`) and Initiative Ally
 * (`initiative-discussion-collaboration.errors.ts`) persistence boundaries.
 */

export class InitiativeCollaborationChannelPersistenceError extends Error {
  readonly code = "INITIATIVE_COLLABORATION_CHANNEL_PERSISTENCE_ERROR";

  constructor(message = "Initiative Collaboration Channel persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "InitiativeCollaborationChannelPersistenceError";
  }
}

/** Thrown when MongoDB is not configured — the Channel has no in-memory fallback (Part 2: never publicly visible, so a silent no-op fallback would be unsafe). */
export class InitiativeCollaborationChannelPersistenceUnavailableError extends InitiativeCollaborationChannelPersistenceError {
  constructor() {
    super("Initiative Collaboration Channel persistence is not configured.");
    this.name = "InitiativeCollaborationChannelPersistenceUnavailableError";
  }
}

export class InitiativeCollaborationChannelNotFoundError extends Error {
  constructor() {
    super("Initiative not found.");
    this.name = "InitiativeCollaborationChannelNotFoundError";
  }
}

/** Part 2 — Author or Active Ally only; guests and non-Allies are always denied. */
export class InitiativeCollaborationChannelAccessDeniedError extends Error {
  constructor() {
    super("You do not have access to this Initiative's Collaboration Channel.");
    this.name = "InitiativeCollaborationChannelAccessDeniedError";
  }
}

export class InitiativeCollaborationChannelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitiativeCollaborationChannelValidationError";
  }
}
