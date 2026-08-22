export class MediaResourceNotFoundError extends Error {
  readonly code = "media_resource_not_found" as const;

  constructor(message = "Media resource not found.") {
    super(message);
    this.name = "MediaResourceNotFoundError";
  }
}

export class MediaResourceValidationError extends Error {
  readonly code = "media_resource_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "MediaResourceValidationError";
  }
}

export class MediaResourceConflictError extends Error {
  readonly code = "media_resource_conflict" as const;

  constructor(message: string) {
    super(message);
    this.name = "MediaResourceConflictError";
  }
}

export class MediaResourceForbiddenDeleteError extends Error {
  readonly code = "media_resource_forbidden_delete" as const;

  constructor(message: string) {
    super(message);
    this.name = "MediaResourceForbiddenDeleteError";
  }
}
