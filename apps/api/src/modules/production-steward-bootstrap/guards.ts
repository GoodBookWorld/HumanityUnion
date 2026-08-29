import {
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG,
  PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE,
  PRODUCTION_STEWARD_BOOTSTRAP_DATABASE,
  isAllowedBootstrapTargetDatabase,
} from "./constants.js";
import { ProductionStewardBootstrapError } from "./errors.js";

export interface BootstrapGuardInput {
  databaseName?: string;
  confirm?: string;
  execute?: boolean;
  allowTestIsolation?: boolean;
}

export function isExecuteModeRequested(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--execute");
}

export function assertBootstrapTargetDatabase(
  databaseName: string | undefined,
  options: { allowTestIsolation?: boolean } = {},
): string {
  const name = databaseName?.trim() ?? "";
  if (!name) {
    throw new ProductionStewardBootstrapError(
      "Refusing production steward bootstrap: MONGODB_DATABASE is required.",
      "MISSING_DATABASE",
    );
  }
  if (!isAllowedBootstrapTargetDatabase(name, options)) {
    throw new ProductionStewardBootstrapError(
      `Refusing production steward bootstrap: database must be ${PRODUCTION_STEWARD_BOOTSTRAP_DATABASE} (got "${name}").`,
      "WRONG_DATABASE",
    );
  }
  return name;
}

/**
 * Write mode requires BOTH --execute and PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM=YES.
 * Dry-run still validates the target database name.
 */
export function assertBootstrapWriteGuards(input: BootstrapGuardInput): void {
  assertBootstrapTargetDatabase(input.databaseName, {
    allowTestIsolation: input.allowTestIsolation,
  });

  if (!input.execute) {
    throw new ProductionStewardBootstrapError(
      "Refusing write: dry-run is default. Pass --execute to write.",
      "DRY_RUN_REQUIRED_EXECUTE_FLAG",
    );
  }

  if (input.confirm !== PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE) {
    throw new ProductionStewardBootstrapError(
      `Refusing write: set ${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_FLAG}=${PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE} to confirm.`,
      "MISSING_CONFIRMATION",
    );
  }
}

export function resolveBootstrapMode(input: {
  execute: boolean;
  confirm?: string;
}): "dry-run" | "execute" {
  if (
    input.execute &&
    input.confirm === PRODUCTION_STEWARD_BOOTSTRAP_CONFIRM_VALUE
  ) {
    return "execute";
  }
  return "dry-run";
}
