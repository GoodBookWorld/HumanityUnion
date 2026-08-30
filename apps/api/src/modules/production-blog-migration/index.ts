export {
  BLOG_ALLOWED_WRITE_COLLECTIONS,
  BLOG_DESTINATION_MONGODB_DATABASE_ENV,
  BLOG_DESTINATION_MONGODB_URI_ENV,
  BLOG_FORBIDDEN_MIGRATE_COLLECTIONS,
  BLOG_MEDIA_RECOVERY_COLLECTION,
  BLOG_RUN_RECOVERY_COLLECTION,
  BLOG_SOURCE_MONGODB_DATABASE_ENV,
  BLOG_SOURCE_MONGODB_URI_ENV,
  BLOG_SUBSCRIPTION_TYPE,
  CRASH_SAFE_BLOG_EXECUTION_ORDER,
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  isTestIsolationDatabase,
} from "./constants.js";

export { ProductionBlogMigrationError } from "./errors.js";

export {
  assertBlogMigrationDestinationDatabase,
  assertBlogMigrationExecuteWriteGuards,
  assertBlogMigrationSourceDatabase,
  assertBlogMigrationWritableCollection,
  assertNoWritePathRequested,
  isBlogExecuteModeRequested,
  isBlogMigrationR2Configured,
  resolveBlogMigrationMode,
  resolveDualBlogMongoEnv,
} from "./guards.js";

export { assertNoSecretLeak, stripForbiddenReportFields } from "./redact.js";

export {
  classifyHumanPotentialCategory,
  classifySeedCategoryPair,
  isExpectedSeedCategoryId,
} from "./categories.js";
export type {
  CategoryCanonicalFields,
  CategoryClassification,
} from "./categories.js";

export {
  classifyMediaUrlHost,
  extractMediaReferencesFromPost,
  extractSafeExternalHost,
  isCanonicalHuMediaUrl,
  isExternalHttpsPreserveReference,
  storageKeyFromMediaUrl,
  summarizeMediaReferences,
} from "./media-inventory.js";
export type {
  ExtractedMediaReference,
  MediaHostClassification,
} from "./media-inventory.js";

export { runProductionBlogMigrationPreflight } from "./preflight.js";
export type {
  BlogMigrationPreflightReport,
  BlogPreflightMutationProof,
  BlogPreflightVerdict,
} from "./preflight.js";

export {
  DualBucketBlogR2Inspector,
  InMemoryBlogR2Inspector,
  classifyBlogDestinationR2Object,
  resolveDualBlogR2Config,
  verifyCanonicalBlogR2Objects,
} from "./r2-preflight.js";
export type {
  BlogCanonicalR2VerificationReport,
  BlogDestinationR2Classification,
  BlogR2ObjectHead,
  BlogR2ObjectInspector,
  BlogR2ObjectVerificationStatus,
} from "./r2-preflight.js";

export {
  DeferredBlogMediaCopyExecutor,
  DualBucketBlogR2CopyExecutor,
  InMemoryBlogR2CopyExecutor,
  destinationUrlForBlogStorageKey,
  isBlogObjectIntegrityEquivalent,
  isPreconditionFailed,
  resolveDualBlogR2CopyConfig,
  sha256Hex,
} from "./r2-copy.js";
export type {
  BlogMediaCopyExecutor,
  BlogMediaCopyOutcome,
  BlogPreparedSourceObject,
} from "./r2-copy.js";

export {
  BLOG_R2_OWNERSHIP_MARKER,
  BLOG_R2_OWNERSHIP_METADATA_KEYS,
  buildBlogMigrationOwnershipMetadata,
  isProvenOwnedByBlogMigration,
  parseBlogMigrationOwnershipMetadata,
} from "./media-ownership.js";

export {
  InMemoryBlogDurableMediaRecoveryStore,
  MongoBlogDurableMediaRecoveryStore,
} from "./media-recovery-store.js";
export type {
  BlogDurableMediaRecoveryRecord,
  BlogDurableMediaRecoveryStore,
} from "./media-recovery-store.js";

export {
  InMemoryBlogRunRecoveryStore,
  MongoBlogRunRecoveryStore,
} from "./run-recovery-store.js";
export type {
  BlogRunRecoveryRecord,
  BlogRunRecoveryStore,
} from "./run-recovery-store.js";

export { BlogMigrationOwnershipLedger } from "./ownership-ledger.js";

export {
  prepareBlogDeliveryForMigration,
  prepareBlogSubscriberForMigration,
  rewriteCanonicalBlogMediaUrl,
  rewriteCanonicalMediaUrlsInHtml,
  sanitizeBlogPostForMigration,
  sanitizeMediaUploadRecordForBlogMigration,
} from "./documents.js";

export {
  blogFailureAllowsOwnedR2Rollback,
  buildSafeBlogMigrationExecutionLog,
  rollbackOwnedBlogMediaObjects,
  runProductionBlogMigration,
} from "./execute.js";
export type {
  BlogMigrationExecutionReport,
  DualBlogMongoHandles,
  RunProductionBlogMigrationInput,
} from "./execute.js";

export { runPostExecuteBlogMigrationVerification } from "./post-execute-verify.js";
export type { BlogPostExecuteVerificationReport } from "./post-execute-verify.js";

export {
  inspectBlogMigrationRecoveryState,
  reconcileBlogMediaCreateAttempted,
  rollbackBlogMigrationOwnedMedia,
} from "./recovery.js";
