/**
 * STAGING HISTORICAL DATA RECONCILIATION PACK 04
 * Reuses Pack 02 approved Participant / Initiative allow-lists.
 */

export {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  BOOTSTRAP_INITIATIVE_ID,
  FORBIDDEN_TARGET_DATABASE_NAMES,
  isAllowedMigrationTargetDatabase,
  isApprovedSourceDatabase,
  isTestIsolationDatabase,
} from "../staging-data-migration/constants.js";

export const STAGING_RECONCILIATION_FLAG = "ALLOW_STAGING_RECONCILIATION";

export const PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH =
  "architecture/recovery/staging-reconciliation-source-v1";

export const STAGING_ADMIN_USER_ID = "13561681-8a25-4bb7-ab97-f9c9e61870bb";
export const STAGING_ADMIN_MEMBER_ID = "58229b2a-adff-4aa0-bb0e-b4d210248ecf";

export const APPROVED_INITIATIVE_IDS = [
  "initiative-1783748417899",
  "initiative-1784349613932",
  "initiative-1785636843367",
  "initiative-1785693642422",
  "initiative-1785948978037",
] as const;

export const APPROVED_HISTORICAL_USER_IDS = [
  "5a56a3fd-58d1-41b3-be64-c15ca3e93a28",
  "2e3375dd-dfb1-42a2-8ce2-98a9022cbaae",
  "0bf8690c-5e07-4fff-8acb-d56722d5ce80",
  "7e876d38-0c1e-4241-b520-44bdfc11781a",
] as const;

export const LEGACY_EXCLUDED_ROOTS = [
  "activities",
  "discussions",
  "proposals",
  "decisions",
] as const;
