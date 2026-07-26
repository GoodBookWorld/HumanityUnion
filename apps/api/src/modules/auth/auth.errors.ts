export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthPersistenceUnavailableError extends Error {
  constructor(message = "Authentication persistence is unavailable. MongoDB is required.") {
    super(message);
    this.name = "AuthPersistenceUnavailableError";
  }
}

export class DuplicateEmailError extends Error {
  constructor(message = "An account with this email already exists.") {
    super(message);
    this.name = "DuplicateEmailError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor(message = "Invalid or expired refresh token.") {
    super(message);
    this.name = "InvalidRefreshTokenError";
  }
}

export class UserDisabledError extends Error {
  constructor(message = "This account has been disabled.") {
    super(message);
    this.name = "UserDisabledError";
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export type AuthCodeRateLimitType =
  "cooldown" | "account_hourly_limit" | "ip_hourly_limit" | "challenge_limit";

export class AuthCodeRateLimitError extends AuthValidationError {
  readonly code = "AUTH_CODE_RATE_LIMITED";
  readonly retryAfterSeconds: number;
  readonly limitType: AuthCodeRateLimitType;

  constructor(message: string, retryAfterSeconds: number, limitType: AuthCodeRateLimitType) {
    super(message);
    this.name = "AuthCodeRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limitType = limitType;
  }
}

export class EmailVerificationRequiredError extends Error {
  constructor(message = "Email verification is required before signing in.") {
    super(message);
    this.name = "EmailVerificationRequiredError";
  }
}

export class RegistrationUnavailableError extends Error {
  constructor(
    message = "Registration is not available right now. Please contact your beta coordinator.",
  ) {
    super(message);
    this.name = "RegistrationUnavailableError";
  }
}
