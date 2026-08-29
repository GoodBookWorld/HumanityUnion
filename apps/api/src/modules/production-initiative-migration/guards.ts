import {
  DESTINATION_MONGODB_DATABASE_ENV,
  DESTINATION_MONGODB_URI_ENV,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  SOURCE_MONGODB_DATABASE_ENV,
  SOURCE_MONGODB_URI_ENV,
  isTestIsolationDatabase,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";

export function assertStagingSourceDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionInitiativeMigrationError(
      "MONGODB_DATABASE is required.",
      "MISSING_DATABASE",
    );
  }
  if (name === PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionInitiativeMigrationError(
    `Refusing staging preflight: database must be ${PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE} (got "${name}").`,
    "WRONG_DATABASE",
  );
}

export function assertProductionCollisionDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionInitiativeMigrationError(
      "MONGODB_DATABASE is required.",
      "MISSING_DATABASE",
    );
  }
  if (name === PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionInitiativeMigrationError(
    `Refusing production collision preflight: database must be ${PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE} (got "${name}").`,
    "WRONG_DATABASE",
  );
}

/** Task 07.1 preflight scripts remain read-only — forbid write flags. */
export function assertNoWritePathRequested(argv: readonly string[] = process.argv): void {
  if (argv.includes("--execute") || argv.includes("--write") || argv.includes("--apply")) {
    throw new ProductionInitiativeMigrationError(
      "This preflight script is read-only. Use the dedicated execute script for write-path dry-run/execute.",
      "WRITE_PATH_FORBIDDEN",
    );
  }
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function resolveMigrationMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  if (input.execute && input.confirm === PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE) {
    return "execute";
  }
  return "dry-run";
}

export function assertMigrationExecuteWriteGuards(input: {
  sourceDatabase: string;
  destinationDatabase: string;
  execute: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
}): void {
  assertMigrationSourceDatabase(input.sourceDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });
  assertMigrationDestinationDatabase(input.destinationDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });

  if (input.sourceDatabase === input.destinationDatabase && !input.allowTestIsolation) {
    throw new ProductionInitiativeMigrationError(
      "Source and destination databases must be distinct.",
      "SAME_SOURCE_DESTINATION",
    );
  }

  if (!input.execute) {
    throw new ProductionInitiativeMigrationError(
      "Refusing write: dry-run is default. Pass --execute to write.",
      "DRY_RUN_REQUIRED_EXECUTE_FLAG",
    );
  }

  if (input.confirm !== PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE) {
    throw new ProductionInitiativeMigrationError(
      `Refusing write: set ${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE}.`,
      "MISSING_CONFIRMATION",
    );
  }
}

export function assertMigrationSourceDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionInitiativeMigrationError(
      `${SOURCE_MONGODB_DATABASE_ENV} is required.`,
      "MISSING_SOURCE_DATABASE",
    );
  }
  if (name === PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionInitiativeMigrationError(
    `Source database must be ${PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE} (got "${name}").`,
    "WRONG_SOURCE_DATABASE",
  );
}

export function assertMigrationDestinationDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionInitiativeMigrationError(
      `${DESTINATION_MONGODB_DATABASE_ENV} is required.`,
      "MISSING_DESTINATION_DATABASE",
    );
  }
  if (name === PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE) {
    return name;
  }
  if (options.allowTestIsolation === true && isTestIsolationDatabase(name)) {
    return name;
  }
  throw new ProductionInitiativeMigrationError(
    `Destination database must be ${PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE} (got "${name}").`,
    "WRONG_DESTINATION_DATABASE",
  );
}

export function resolveDualMongoEnv(env: NodeJS.ProcessEnv = process.env): {
  sourceUri: string;
  sourceDatabase: string;
  destinationUri: string;
  destinationDatabase: string;
} {
  const sourceUri = env[SOURCE_MONGODB_URI_ENV]?.trim() ?? "";
  const destinationUri = env[DESTINATION_MONGODB_URI_ENV]?.trim() ?? "";
  const sourceDatabase = env[SOURCE_MONGODB_DATABASE_ENV]?.trim() ?? "";
  const destinationDatabase = env[DESTINATION_MONGODB_DATABASE_ENV]?.trim() ?? "";

  if (!sourceUri || !destinationUri) {
    throw new ProductionInitiativeMigrationError(
      `Set ${SOURCE_MONGODB_URI_ENV} and ${DESTINATION_MONGODB_URI_ENV} explicitly. Never infer both sides from one service DB.`,
      "MISSING_DUAL_URI",
    );
  }
  if (!sourceDatabase || !destinationDatabase) {
    throw new ProductionInitiativeMigrationError(
      `Set ${SOURCE_MONGODB_DATABASE_ENV} and ${DESTINATION_MONGODB_DATABASE_ENV}.`,
      "MISSING_DUAL_DATABASE",
    );
  }
  if (sourceUri === destinationUri && sourceDatabase === destinationDatabase) {
    throw new ProductionInitiativeMigrationError(
      "Source and destination Mongo targets must not be identical.",
      "SAME_SOURCE_DESTINATION",
    );
  }

  return { sourceUri, sourceDatabase, destinationUri, destinationDatabase };
}
