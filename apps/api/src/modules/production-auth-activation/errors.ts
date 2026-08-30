export class ProductionAuthActivationError extends Error {
  readonly code: string;

  constructor(message: string, code = "PRODUCTION_AUTH_ACTIVATION_ERROR") {
    super(message);
    this.name = "ProductionAuthActivationError";
    this.code = code;
  }
}
