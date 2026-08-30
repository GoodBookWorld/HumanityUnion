import {
  BLOG_ALLOWED_WRITE_COLLECTIONS,
  BLOG_DESTINATION_MONGODB_DATABASE_ENV,
  BLOG_DESTINATION_MONGODB_URI_ENV,
  BLOG_FORBIDDEN_MIGRATE_COLLECTIONS,
  BLOG_SOURCE_MONGODB_DATABASE_ENV,
  BLOG_SOURCE_MONGODB_URI_ENV,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  isTestIsolationDatabase,
} from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";

export function assertNoWritePathRequested(argv: readonly string[] = process.argv): void {
  if (argv.includes("--execute") || argv.includes("--write") || argv.includes("--apply")) {
    throw new ProductionBlogMigrationError(
      "This Blog migration preflight is read-only. Use execute:production-blog-migration for writes.",
      "WRITE_PATH_FORBIDDEN",
    );
  }
}

export function isBlogExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function resolveBlogMigrationMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  if (input.execute && input.confirm === PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE) {
    return "execute";
  }
  return "dry-run";
}

export function assertBlogMigrationExecuteWriteGuards(input: {
  sourceDatabase: string;
  destinationDatabase: string;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
}): void {
  if (!input.execute) {
    throw new ProductionBlogMigrationError(
      "Refusing write: dry-run is default. Pass --execute to write.",
      "DRY_RUN_REQUIRED_EXECUTE_FLAG",
    );
  }
  if (input.confirm !== PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE) {
    throw new ProductionBlogMigrationError(
      `Refusing write: set ${PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE}.`,
      "MISSING_CONFIRMATION",
    );
  }
  assertBlogMigrationSourceDatabase(input.sourceDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  assertBlogMigrationDestinationDatabase(input.destinationDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  if (input.sourceDatabase === input.destinationDatabase) {
    throw new ProductionBlogMigrationError(
      "Source and destination databases must differ.",
      "SAME_SOURCE_DESTINATION",
    );
  }
}

export function assertBlogMigrationWritableCollection(collection: string): void {
  if ((BLOG_FORBIDDEN_MIGRATE_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new ProductionBlogMigrationError(
      `Forbidden Blog migration collection: ${collection}`,
      "FORBIDDEN_COLLECTION",
    );
  }
  if (!(BLOG_ALLOWED_WRITE_COLLECTIONS as readonly string[]).includes(collection)) {
    throw new ProductionBlogMigrationError(
      `Collection not on Blog migration allow-list: ${collection}`,
      "COLLECTION_NOT_ALLOWLISTED",
    );
  }
}

export function assertBlogMigrationSourceDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionBlogMigrationError(
      `${BLOG_SOURCE_MONGODB_DATABASE_ENV} is required.`,
      "MISSING_SOURCE_DATABASE",
    );
  }
  if (name === PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionBlogMigrationError(
    `Source database must be ${PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE} (got "${name}").`,
    "WRONG_SOURCE_DATABASE",
  );
}

export function assertBlogMigrationDestinationDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionBlogMigrationError(
      `${BLOG_DESTINATION_MONGODB_DATABASE_ENV} is required.`,
      "MISSING_DESTINATION_DATABASE",
    );
  }
  if (name === PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionBlogMigrationError(
    `Destination database must be ${PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE} (got "${name}").`,
    "WRONG_DESTINATION_DATABASE",
  );
}

export function resolveDualBlogMongoEnv(env: NodeJS.ProcessEnv = process.env): {
  sourceUri: string;
  sourceDatabase: string;
  destinationUri: string;
  destinationDatabase: string;
} {
  const sourceUri = env[BLOG_SOURCE_MONGODB_URI_ENV]?.trim() ?? "";
  const destinationUri = env[BLOG_DESTINATION_MONGODB_URI_ENV]?.trim() ?? "";
  const sourceDatabase = env[BLOG_SOURCE_MONGODB_DATABASE_ENV]?.trim() ?? "";
  const destinationDatabase = env[BLOG_DESTINATION_MONGODB_DATABASE_ENV]?.trim() ?? "";

  if (!sourceUri || !destinationUri) {
    throw new ProductionBlogMigrationError(
      `Set ${BLOG_SOURCE_MONGODB_URI_ENV} and ${BLOG_DESTINATION_MONGODB_URI_ENV} explicitly.`,
      "MISSING_DUAL_URI",
    );
  }
  if (!sourceDatabase || !destinationDatabase) {
    throw new ProductionBlogMigrationError(
      `Set ${BLOG_SOURCE_MONGODB_DATABASE_ENV} and ${BLOG_DESTINATION_MONGODB_DATABASE_ENV}.`,
      "MISSING_DUAL_DATABASE",
    );
  }
  if (sourceUri === destinationUri && sourceDatabase === destinationDatabase) {
    throw new ProductionBlogMigrationError(
      "Source and destination Mongo targets must not be identical.",
      "SAME_SOURCE_DESTINATION",
    );
  }

  return { sourceUri, sourceDatabase, destinationUri, destinationDatabase };
}

/** True only when all eight Blog migration R2 env vars are non-empty. */
export function isBlogMigrationR2Configured(env: NodeJS.ProcessEnv = process.env): boolean {
  const keys = [
    "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCOUNT_ID",
    "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCESS_KEY_ID",
    "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_SECRET_ACCESS_KEY",
    "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_BUCKET",
    "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCOUNT_ID",
    "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCESS_KEY_ID",
    "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_SECRET_ACCESS_KEY",
    "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_BUCKET",
  ] as const;
  return keys.every((key) => Boolean(env[key]?.trim()));
}
