export class ProductionInitiativeMigrationError extends Error {
  readonly code: string;

  constructor(message: string, code = "PRODUCTION_INITIATIVE_MIGRATION_ERROR") {
    super(message);
    this.name = "ProductionInitiativeMigrationError";
    this.code = code;
  }
}
