export class ProductionBlogMigrationError extends Error {
  readonly code: string;

  constructor(message: string, code = "PRODUCTION_BLOG_MIGRATION_ERROR") {
    super(message);
    this.name = "ProductionBlogMigrationError";
    this.code = code;
  }
}
