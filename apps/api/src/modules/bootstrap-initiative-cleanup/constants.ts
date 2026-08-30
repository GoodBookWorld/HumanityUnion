/**
 * Pack 01.1 — obsolete bootstrap Initiative cleanup (staging / non-production only).
 * Exact allow-list; do not generalize to arbitrary Initiative IDs.
 */

export const BOOTSTRAP_INITIATIVE_CLEANUP_ID = "initiative-bootstrap-001" as const;

export const BOOTSTRAP_INITIATIVE_CLEANUP_EXPECTED_TITLE =
  "Community Garden Initiative" as const;

/** Explicit opt-in required with --execute. */
export const BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM_ENV =
  "BOOTSTRAP_INITIATIVE_CLEANUP_CONFIRM" as const;

export const BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE = "humanity_union_staging" as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

const FORBIDDEN_DATABASE_NAMES = new Set([
  "humanity_union_dev",
  "humanity_union",
  "humanity_union_production",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

export function isAllowedBootstrapInitiativeCleanupDatabase(
  database: string,
  options: { nodeTestEnv?: boolean } = {},
): boolean {
  const name = database.trim();
  if (!name || FORBIDDEN_DATABASE_NAMES.has(name)) {
    return false;
  }
  if (name === BOOTSTRAP_INITIATIVE_CLEANUP_DATABASE) {
    return true;
  }
  if (options.nodeTestEnv === true && TEST_DATABASE_NAME_PATTERN.test(name)) {
    return true;
  }
  return false;
}

export function assertAllowListedBootstrapInitiativeId(initiativeId: string): string {
  const trimmed = initiativeId.trim();
  if (trimmed !== BOOTSTRAP_INITIATIVE_CLEANUP_ID) {
    throw new Error(
      `Refusing cleanup: initiativeId must be exactly "${BOOTSTRAP_INITIATIVE_CLEANUP_ID}".`,
    );
  }
  return trimmed;
}
