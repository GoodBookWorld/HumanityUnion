export class PlatformSupportLinkValidationError extends Error {
  readonly code = "platform_support_link_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "PlatformSupportLinkValidationError";
  }
}

export class PlatformSupportLinkNotFoundError extends Error {
  readonly code = "platform_support_link_not_found" as const;

  constructor(message = "Platform support link was not found.") {
    super(message);
    this.name = "PlatformSupportLinkNotFoundError";
  }
}

export class PlatformSupportLinkPersistenceError extends Error {
  readonly code = "platform_support_link_persistence" as const;
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PlatformSupportLinkPersistenceError";
    this.cause = cause;
  }
}
