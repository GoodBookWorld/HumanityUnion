export {
  APPROVED_HISTORICAL_INITIATIVES,
  APPROVED_HISTORICAL_PARTICIPANTS,
  APPROVED_SOURCE_DATABASE,
  APPROVED_TARGET_DATABASE,
  BOOTSTRAP_INITIATIVE_ID,
  EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT,
  EXPECTED_TARGET_PARTICIPANT_COUNT,
  LEGACY_EXCLUDED_COLLECTIONS,
  STAGING_DATA_MIGRATION_FLAG,
  isAllowedMigrationTargetDatabase,
  isApprovedSourceDatabase,
} from "./constants.js";

export {
  StagingDataMigrationError,
  assertStagingDataMigrationDatabasePair,
  assertStagingDataMigrationExecuteGuards,
  isExecuteModeRequested,
} from "./guards.js";

export { buildMigrationPlan, shouldMergeByDisplayName } from "./plan.js";
export type { MigrationSourceBundle } from "./plan.js";

export {
  assertApprovedSourcesPresent,
  loadMigrationSourceBundle,
  resolveCivicSourceDir,
  resolveDefaultRuntimeDir,
  resolveRepoRoot,
  validatePack01Manifest,
} from "./load-sources.js";

export {
  loadAndValidatePortableCivicSource,
  PORTABLE_CIVIC_SOURCE_RELATIVE_PATH,
  computeBundleChecksum,
  computeFileChecksums,
} from "./portable-source-bundle.js";

export { executeStagingHistoricalMigration, writePreMigrationSnapshot } from "./execute.js";
export { maskEmail, redactAuthDocument, emailFingerprint } from "./redact.js";
