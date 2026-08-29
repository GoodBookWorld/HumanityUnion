export class ProductionAdminBootstrapError extends Error {
  readonly code: string;

  constructor(message: string, code = "PRODUCTION_ADMIN_BOOTSTRAP_ERROR") {
    super(message);
    this.name = "ProductionAdminBootstrapError";
    this.code = code;
  }
}
