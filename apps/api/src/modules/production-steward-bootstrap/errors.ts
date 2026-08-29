export class ProductionStewardBootstrapError extends Error {
  readonly code: string;

  constructor(message: string, code = "PRODUCTION_STEWARD_BOOTSTRAP_ERROR") {
    super(message);
    this.name = "ProductionStewardBootstrapError";
    this.code = code;
  }
}
