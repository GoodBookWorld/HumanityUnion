export class RrpApplicationValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RrpApplicationValidationError";
    this.statusCode = statusCode;
  }
}

export class RrpApplicationAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RrpApplicationAccessDeniedError";
  }
}

export class RrpApplicationNotFoundError extends Error {
  constructor(message = "Regional Representative application not found.") {
    super(message);
    this.name = "RrpApplicationNotFoundError";
  }
}

export class RrpApplicationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RrpApplicationConflictError";
  }
}

export class RrpApplicationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RrpApplicationUnavailableError";
  }
}
