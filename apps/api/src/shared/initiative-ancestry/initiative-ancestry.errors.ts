/**
 * Typed failures for Initiative ancestry validation.
 *
 * See ./README.md and architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md
 * for the governing invariant. Messages are intentionally generic and do not
 * expose repository/persistence internals.
 */

export class InitiativeAncestryMissingError extends Error {
  readonly code = "INITIATIVE_ANCESTRY_MISSING";

  constructor(message = "Initiative ancestry is required.") {
    super(message);
    this.name = "InitiativeAncestryMissingError";
  }
}

export class InitiativeIdMalformedError extends Error {
  readonly code = "INITIATIVE_ID_MALFORMED";

  constructor(message = "Initiative identifier is malformed.") {
    super(message);
    this.name = "InitiativeIdMalformedError";
  }
}

export class InitiativeNotFoundError extends Error {
  readonly code = "INITIATIVE_NOT_FOUND";

  constructor(message = "Referenced Initiative does not exist.") {
    super(message);
    this.name = "InitiativeNotFoundError";
  }
}

export class UnsupportedParentArtifactTypeError extends Error {
  readonly code = "UNSUPPORTED_PARENT_ARTIFACT_TYPE";

  constructor(message = "Parent artifact type is not a supported civic artifact.") {
    super(message);
    this.name = "UnsupportedParentArtifactTypeError";
  }
}

export class ParentArtifactNotFoundError extends Error {
  readonly code = "PARENT_ARTIFACT_NOT_FOUND";

  constructor(message = "Referenced parent civic artifact does not exist.") {
    super(message);
    this.name = "ParentArtifactNotFoundError";
  }
}

export class ParentArtifactMissingInitiativeAncestryError extends Error {
  readonly code = "PARENT_ARTIFACT_MISSING_INITIATIVE_ANCESTRY";

  constructor(message = "Parent civic artifact has no Initiative ancestry of its own.") {
    super(message);
    this.name = "ParentArtifactMissingInitiativeAncestryError";
  }
}

export class InitiativeAncestryResolutionInconsistentError extends Error {
  readonly code = "INITIATIVE_ANCESTRY_RESOLUTION_INCONSISTENT";

  constructor(message = "Initiative ancestry resolution produced an inconsistent result.") {
    super(message);
    this.name = "InitiativeAncestryResolutionInconsistentError";
  }
}

/** Union of every typed failure this validator can raise. */
export type InitiativeAncestryError =
  | InitiativeAncestryMissingError
  | InitiativeIdMalformedError
  | InitiativeNotFoundError
  | UnsupportedParentArtifactTypeError
  | ParentArtifactNotFoundError
  | ParentArtifactMissingInitiativeAncestryError
  | InitiativeAncestryResolutionInconsistentError;
