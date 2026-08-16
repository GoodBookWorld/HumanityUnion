/**
 * STAGING DATA MIGRATION PACK 03 — historical media recovery constants.
 */

export const APPROVED_TARGET_DATABASE = "humanity_union_staging";
export const STAGING_MEDIA_MIGRATION_FLAG = "ALLOW_STAGING_MEDIA_MIGRATION";

export const PORTABLE_MEDIA_SOURCE_RELATIVE_PATH =
  "architecture/recovery/staging-media-source-v1";

export const MEDIA_RECOVERY_MANIFEST_RELATIVE_PATH =
  "architecture/recovery/STAGING_MEDIA_RECOVERY_MANIFEST_v1.0.json";

export const STAGING_ADMIN_MEMBER_ID = "58229b2a-adff-4aa0-bb0e-b4d210248ecf";
export const STAGING_ADMIN_USER_ID = "13561681-8a25-4bb7-ab97-f9c9e61870bb";

export const FORBIDDEN_TARGET_DATABASE_NAMES = new Set([
  "humanity_union_dev",
  "humanity_union",
  "humanity_union_production",
  "production",
  "development",
  "admin",
  "local",
  "config",
]);

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export function isAllowedMediaMigrationTargetDatabase(
  database: string,
  options: { nodeTestEnv?: boolean } = {},
): boolean {
  const name = database.trim();
  if (!name || FORBIDDEN_TARGET_DATABASE_NAMES.has(name)) {
    return false;
  }
  if (name === APPROVED_TARGET_DATABASE) {
    return true;
  }
  if (options.nodeTestEnv === true && TEST_DATABASE_NAME_PATTERN.test(name)) {
    return true;
  }
  return false;
}
