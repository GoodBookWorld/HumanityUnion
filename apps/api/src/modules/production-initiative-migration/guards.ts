import {
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
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

/** Task 07.1: no execute / write mode exists. */
export function assertNoWritePathRequested(argv: readonly string[] = process.argv): void {
  if (argv.includes("--execute") || argv.includes("--write") || argv.includes("--apply")) {
    throw new ProductionInitiativeMigrationError(
      "Task 07.1 is read-only preflight only. No --execute / write path exists.",
      "WRITE_PATH_FORBIDDEN",
    );
  }
}
