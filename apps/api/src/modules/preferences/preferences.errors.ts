export class PreferencesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferencesValidationError";
  }
}

export class PreferencesNotFoundError extends Error {
  constructor() {
    super("Member preferences not found.");
    this.name = "PreferencesNotFoundError";
  }
}

export class PreferencesPersistenceUnavailableError extends Error {
  constructor() {
    super("Member preferences persistence is unavailable.");
    this.name = "PreferencesPersistenceUnavailableError";
  }
}
