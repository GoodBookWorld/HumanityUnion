/**
 * Admin Foundation Pack 02 — canonical authorization / audit errors.
 * Calm messages; no stack traces exposed to clients by these types alone.
 */

export class AdministrationUnauthorizedError extends Error {
  readonly code = "administration_unauthorized" as const;

  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AdministrationUnauthorizedError";
  }
}

export class AdministrationForbiddenError extends Error {
  readonly code = "administration_forbidden" as const;

  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AdministrationForbiddenError";
  }
}

export class AdministrationInsufficientCapabilityError extends Error {
  readonly code = "administration_insufficient_capability" as const;
  readonly capability: string;

  constructor(capability: string, message?: string) {
    super(message ?? `Missing required capability: ${capability}.`);
    this.name = "AdministrationInsufficientCapabilityError";
    this.capability = capability;
  }
}

export class AdministrationScopeMismatchError extends Error {
  readonly code = "administration_scope_mismatch" as const;

  constructor(message = "Capability scope does not match the target resource.") {
    super(message);
    this.name = "AdministrationScopeMismatchError";
  }
}

export class AdministrationValidationError extends Error {
  readonly code = "administration_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "AdministrationValidationError";
  }
}

export class AdministrationAuditImmutableError extends Error {
  readonly code = "administration_audit_immutable" as const;

  constructor(message = "Administration audit records are append-only.") {
    super(message);
    this.name = "AdministrationAuditImmutableError";
  }
}
