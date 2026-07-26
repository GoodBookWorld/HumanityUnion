import { AuthPersistenceUnavailableError } from "../auth/auth.errors.js";

export class MemberProfileNotFoundError extends Error {
  constructor(message = "Member profile not found.") {
    super(message);
    this.name = "MemberProfileNotFoundError";
  }
}

export class MemberProfileAccessDeniedError extends Error {
  constructor(message = "Member profile is not accessible.") {
    super(message);
    this.name = "MemberProfileAccessDeniedError";
  }
}

export class MemberProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberProfileValidationError";
  }
}

export class MemberProfilePersistenceUnavailableError extends Error {
  constructor(message = "Member profile persistence is unavailable. MongoDB is required.") {
    super(message);
    this.name = "MemberProfilePersistenceUnavailableError";
  }
}

export function mapMemberProfilePersistenceError(error: unknown): never {
  if (error instanceof AuthPersistenceUnavailableError) {
    throw new MemberProfilePersistenceUnavailableError();
  }

  throw error;
}
