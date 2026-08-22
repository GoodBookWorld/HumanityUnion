export class CountryAffiliationNotFoundError extends Error {
  readonly code = "country_affiliation_not_found" as const;

  constructor(message = "Country affiliation entry not found.") {
    super(message);
    this.name = "CountryAffiliationNotFoundError";
  }
}

export class CountryAffiliationValidationError extends Error {
  readonly code = "country_affiliation_validation" as const;

  constructor(message: string) {
    super(message);
    this.name = "CountryAffiliationValidationError";
  }
}

export class CountryAffiliationConflictError extends Error {
  readonly code = "country_affiliation_conflict" as const;

  constructor(message: string) {
    super(message);
    this.name = "CountryAffiliationConflictError";
  }
}

export class CountryAffiliationForbiddenDeleteError extends Error {
  readonly code = "country_affiliation_forbidden_delete" as const;

  constructor(message: string) {
    super(message);
    this.name = "CountryAffiliationForbiddenDeleteError";
  }
}
