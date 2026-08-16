/**
 * STAGING DATA MIGRATION PACK 02 — approved allow-lists and logical DB names.
 * Identity matching uses canonical IDs / email — never displayName.
 */

export const APPROVED_SOURCE_DATABASE = "humanity_union_dev";
export const APPROVED_TARGET_DATABASE = "humanity_union_staging";

export const STAGING_DATA_MIGRATION_FLAG = "ALLOW_STAGING_DATA_MIGRATION";

export const PACK01_MANIFEST_RELATIVE_PATH =
  "architecture/recovery/STAGING_DATA_MIGRATION_MANIFEST_v1.0.json";

export const PORTABLE_CIVIC_SOURCE_RELATIVE_PATH =
  "architecture/recovery/staging-data-source-v1";

export const PRE_MIGRATION_SNAPSHOT_RUNTIME_RELATIVE_PATH =
  "apps/api/.runtime/recovery/STAGING_DATA_PRE_MIGRATION_SNAPSHOT_v1.0.json";

export const EXECUTION_PLAN_RELATIVE_PATH =
  "architecture/recovery/STAGING_DATA_MIGRATION_EXECUTION_PLAN_v1.0.md";

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

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

/** Historical Participants approved for Pack 02 (separate from staging admin). */
export const APPROVED_HISTORICAL_PARTICIPANTS = [
  {
    key: "historical_vlad_gmail",
    memberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    displayName: "Vlad",
    emailDomainHint: "gmail.com",
    classification: "SEPARATE_PARTICIPANT" as const,
    note: "Distinct from staging-admin Vlad HUWS; displayName must not merge.",
  },
  {
    key: "michael",
    memberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    displayName: "Michael",
    emailDomainHint: "gmail.com",
    classification: "SAFE_TO_MIGRATE_WITH_AUTH_RESET" as const,
    note: "Approved historical Participant.",
  },
  {
    key: "derek",
    memberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    displayName: "Derek",
    emailDomainHint: "gmail.com",
    classification: "SAFE_TO_MIGRATE_WITH_AUTH_RESET" as const,
    note: "Approved historical Participant.",
  },
  {
    key: "isabella",
    memberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    displayName: "Isabella",
    emailDomainHint: "gmail.com",
    classification: "SAFE_TO_MIGRATE_WITH_AUTH_RESET" as const,
    note: "Approved historical Participant; steward of Isabella Initiative.",
  },
] as const;

/** Five confirmed working Initiatives (Isabella Initiative explicitly in scope). */
export const APPROVED_HISTORICAL_INITIATIVES = [
  {
    initiativeId: "initiative-1783748417899",
    title: "Citizen Support Squad (CSS)",
    stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    classification: "REQUIRES_TRANSFORM" as const,
  },
  {
    initiativeId: "initiative-1784349613932",
    title: "The Mind-Safe Alliance",
    stewardMemberId: "a5e65d2f-3be7-4f8f-acd9-87c68027d662",
    classification: "REQUIRES_TRANSFORM" as const,
  },
  {
    initiativeId: "initiative-1785636843367",
    title: 'Bridging the "New World Disorder"',
    stewardMemberId: "9cde6a4e-0fda-4132-8e7e-78432b864231",
    classification: "REQUIRES_TRANSFORM" as const,
  },
  {
    initiativeId: "initiative-1785693642422",
    title: "AI for the Common Good",
    stewardMemberId: "57696395-199d-48b2-bbeb-bc30d2a1ba6c",
    classification: "REQUIRES_TRANSFORM" as const,
  },
  {
    initiativeId: "initiative-1785948978037",
    title: "Development of the Humanity Union platform",
    stewardMemberId: "5bb8e373-c042-4786-a69c-0340301711d8",
    classification: "REQUIRES_TRANSFORM" as const,
    note: "Isabella Initiative — explicitly APPROVED in Pack 02; not optional.",
  },
] as const;

export const BOOTSTRAP_INITIATIVE_ID = "initiative-bootstrap-001";

export const LEGACY_EXCLUDED_COLLECTIONS = [
  "activities",
  "discussions",
  "proposals",
  "decisions",
] as const;

export const AUTH_SECRET_FIELDS = [
  "passwordHash",
  "refreshToken",
  "refreshTokens",
  "sessionId",
  "sessions",
  "token",
  "tokens",
  "verificationSecret",
  "verificationToken",
  "passwordResetToken",
  "confirmationSecret",
] as const;

export const EXPECTED_TARGET_PARTICIPANT_COUNT = 5;
export const EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT = 5;

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}

export function isApprovedSourceDatabase(database: string): boolean {
  return database.trim() === APPROVED_SOURCE_DATABASE;
}

export function isAllowedMigrationTargetDatabase(
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
  if (options.nodeTestEnv === true && isTestIsolationDatabase(name)) {
    return true;
  }
  return false;
}
