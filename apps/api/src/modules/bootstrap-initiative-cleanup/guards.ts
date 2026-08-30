import {
  BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV,
  BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE,
  BOOTSTRAP_INITIATIVE_CLEANUP_ID,
  isAllowedBootstrapInitiativeCleanupDatabase,
} from "./constants.js";
import { BootstrapInitiativeCleanupValidationError } from "./errors.js";

export interface BootstrapInitiativeCleanupGuardInput {
  NODE_ENV?: string;
  PLATFORM_MODE?: string;
  MONGODB_DATABASE?: string;
  NODE_TEST_ENV?: string;
  [BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV]?: string;
  execute?: boolean;
}

/**
 * Pure guard evaluation — used by the CLI and by focused unit tests.
 */
export function assertBootstrapInitiativeCleanupGuards(
  input: BootstrapInitiativeCleanupGuardInput,
): { database: string; nodeTestEnv: boolean } {
  const explicitPlatform = input.PLATFORM_MODE?.trim();
  if (explicitPlatform === "production") {
    throw new BootstrapInitiativeCleanupValidationError(
      "Refusing bootstrap Initiative cleanup against PLATFORM_MODE=production.",
    );
  }

  const database = (input.MONGODB_DATABASE ?? "").trim();
  const nodeTestEnv = input.NODE_TEST_ENV === "true";

  if (!isAllowedBootstrapInitiativeCleanupDatabase(database, { nodeTestEnv })) {
    throw new BootstrapInitiativeCleanupValidationError(
      `Refusing bootstrap Initiative cleanup against database "${database || "(empty)"}" (expected ${BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE} or hu_test_* under NODE_TEST_ENV=true).`,
    );
  }

  if (input.execute === true) {
    const confirm = input[BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV]?.trim();
    if (confirm !== "YES") {
      throw new BootstrapInitiativeCleanupValidationError(
        `Refusing write: set ${BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV}=YES with --execute.`,
      );
    }
  }

  return { database, nodeTestEnv };
}

export function assertCleanupTargetsAllowListedId(initiativeId: string): void {
  if (initiativeId.trim() !== BOOTSTRAP_INITIATIVE_CLEANUP_ID) {
    throw new BootstrapInitiativeCleanupValidationError(
      `Refusing cleanup: only "${BOOTSTRAP_INITIATIVE_CLEANUP_ID}" is allow-listed.`,
    );
  }
}
