import {
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_ADMIN_BOOTSTRAP_DATABASE,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  isAllowedAdminBootstrapTargetDatabase,
} from "./constants.js";
import { ProductionAdminBootstrapError } from "./errors.js";

export interface AdminBootstrapGuardInput {
  databaseName?: string;
  confirm?: string;
  adminConfirm?: string;
  execute?: boolean;
  allowTestIsolation?: boolean;
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function assertAdminBootstrapTargetDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionAdminBootstrapError(
      "Refusing production admin bootstrap: MONGODB_DATABASE is required.",
      "MISSING_DATABASE",
    );
  }
  if (!isAllowedAdminBootstrapTargetDatabase(name, options)) {
    throw new ProductionAdminBootstrapError(
      `Refusing production admin bootstrap: database must be ${PRODUCTION_ADMIN_BOOTSTRAP_DATABASE} (got "${name}").`,
      "WRONG_DATABASE",
    );
  }
  return name;
}

/**
 * Write mode requires --execute AND steward confirm AND admin confirm.
 */
export function assertAdminBootstrapWriteGuards(input: AdminBootstrapGuardInput): void {
  assertAdminBootstrapTargetDatabase(input.databaseName, {
    allowTestIsolation: input.allowTestIsolation,
  });

  if (!input.execute) {
    throw new ProductionAdminBootstrapError(
      "Refusing write: dry-run is default. Pass --execute to write.",
      "DRY_RUN_REQUIRED_EXECUTE_FLAG",
    );
  }

  if (input.confirm !== PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE) {
    throw new ProductionAdminBootstrapError(
      `Refusing write: set ${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE}.`,
      "MISSING_CONFIRMATION",
    );
  }

  if (input.adminConfirm !== PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE) {
    throw new ProductionAdminBootstrapError(
      `Refusing Admin write: set ${PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE}.`,
      "MISSING_ADMIN_CONFIRMATION",
    );
  }
}

export function resolveAdminBootstrapMode(input: {
  execute: boolean;
  confirm?: string;
  adminConfirm?: string;
}): "dry-run" | "execute" {
  if (
    input.execute &&
    input.confirm === PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE &&
    input.adminConfirm === PRODUCTION_ADMIN_BOOTSTRAP_CONFIRM_VALUE
  ) {
    return "execute";
  }
  return "dry-run";
}
