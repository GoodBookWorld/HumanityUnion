export class ParticipationAreaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipationAreaValidationError";
  }
}

export class ParticipationAreaConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParticipationAreaConflictError";
  }
}

export class ParticipationAreaNotFoundError extends Error {
  constructor(message = "Participation Area not found.") {
    super(message);
    this.name = "ParticipationAreaNotFoundError";
  }
}
