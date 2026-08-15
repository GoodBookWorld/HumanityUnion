/**
 * Communication UX Pack 03.6 — narrow error types for Collaboration
 * Sessions, mirroring the shape already established for the Collaboration
 * Channel (`initiative-collaboration-channel.errors.ts`).
 */

export class InitiativeCollaborationSessionPersistenceError extends Error {
  readonly code = "INITIATIVE_COLLABORATION_SESSION_PERSISTENCE_ERROR";

  constructor(message = "Collaboration Session persistence failed.", cause?: unknown) {
    super(message, { cause });
    this.name = "InitiativeCollaborationSessionPersistenceError";
  }
}

/** Thrown when MongoDB is not configured — Sessions have no in-memory fallback (Part 2: never publicly visible). */
export class InitiativeCollaborationSessionPersistenceUnavailableError extends InitiativeCollaborationSessionPersistenceError {
  constructor() {
    super("Collaboration Session persistence is not configured.");
    this.name = "InitiativeCollaborationSessionPersistenceUnavailableError";
  }
}

export class InitiativeCollaborationSessionNotFoundError extends Error {
  constructor(message = "Initiative not found.") {
    super(message);
    this.name = "InitiativeCollaborationSessionNotFoundError";
  }
}

/** Part 2 — Author or Active Ally only; guests and non-Allies are always denied. */
export class InitiativeCollaborationSessionAccessDeniedError extends Error {
  constructor(message = "You do not have access to this Initiative's Collaboration Sessions.") {
    super(message);
    this.name = "InitiativeCollaborationSessionAccessDeniedError";
  }
}

/** Part 5 — only the Author who owns the Initiative may create/edit/cancel a Session. */
export class InitiativeCollaborationSessionAuthorOnlyError extends Error {
  constructor(message = "Only the Initiative Author may manage Collaboration Sessions.") {
    super(message);
    this.name = "InitiativeCollaborationSessionAuthorOnlyError";
  }
}

/** Part 6 — the Author organizes Sessions; they never record their own attendance. */
export class InitiativeCollaborationSessionAttendanceRestrictedError extends Error {
  constructor(message = "Only Active Allies may record attendance for a Collaboration Session.") {
    super(message);
    this.name = "InitiativeCollaborationSessionAttendanceRestrictedError";
  }
}

export class InitiativeCollaborationSessionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitiativeCollaborationSessionValidationError";
  }
}
