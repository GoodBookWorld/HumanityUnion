/**
 * Production auth activation — password-reset invite for migrated/bootstrap shells.
 * Never hardcodes emails. Never prints emails, hashes, or raw tokens.
 */

export const PRODUCTION_AUTH_ACTIVATION_CONFIRM_FLAG =
  "PRODUCTION_AUTH_ACTIVATION_CONFIRM" as const;
export const PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE = "YES" as const;

/** Optional comma-separated extra userIds (never emails). */
export const PRODUCTION_AUTH_ACTIVATION_USER_IDS_ENV =
  "PRODUCTION_AUTH_ACTIVATION_USER_IDS" as const;

export const PRODUCTION_AUTH_ACTIVATION_TARGET_DATABASE =
  "humanity_union_production" as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}
