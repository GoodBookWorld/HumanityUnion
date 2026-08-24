export class PlatformSocialAccountValidationError extends Error {
  readonly code = "platform_social_account_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "PlatformSocialAccountValidationError";
  }
}

export class PlatformSocialAccountNotFoundError extends Error {
  readonly code = "platform_social_account_not_found" as const;

  constructor(message = "Platform social network was not found.") {
    super(message);
    this.name = "PlatformSocialAccountNotFoundError";
  }
}

export class PlatformSocialAccountPersistenceError extends Error {
  readonly code = "platform_social_account_persistence" as const;
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PlatformSocialAccountPersistenceError";
    this.cause = cause;
  }
}
