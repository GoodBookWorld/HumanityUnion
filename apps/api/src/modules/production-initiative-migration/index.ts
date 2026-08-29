export {
  ALLOWED_WRITE_COLLECTIONS,
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_INITIATIVE_EXPECTATIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  DESTINATION_MONGODB_DATABASE_ENV,
  DESTINATION_MONGODB_URI_ENV,
  DESTINATION_R2_ACCESS_KEY_ID_ENV,
  DESTINATION_R2_ACCOUNT_ID_ENV,
  DESTINATION_R2_BUCKET_ENV,
  DESTINATION_R2_PUBLIC_BASE_URL_ENV,
  DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_MIGRATE_COLLECTIONS,
  FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
  MEDIA_COPY_ENABLED_ENV,
  MEDIA_COPY_ENABLED_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  SOURCE_MONGODB_DATABASE_ENV,
  SOURCE_MONGODB_URI_ENV,
  SOURCE_R2_ACCESS_KEY_ID_ENV,
  SOURCE_R2_ACCOUNT_ID_ENV,
  SOURCE_R2_BUCKET_ENV,
  SOURCE_R2_SECRET_ACCESS_KEY_ENV,
  SYSTEM_MEDIA_RECOVERY_OWNER,
  VLAD_SHAPRAN_MEMBER_ID,
  VLAD_SHAPRAN_USER_ID,
  EXPECTED_MUST_MIGRATE_CIVIC_CHILDREN,
  EXPECTED_UNIQUE_PUBLIC_MEDIA_OBJECTS,
  isCanonicalInitiativeId,
  isExcludedInitiativeId,
  isForbiddenTypoAiCommonGoodId,
} from "./constants.js";

export { ProductionInitiativeMigrationError } from "./errors.js";

export {
  assertMigrationDestinationDatabase,
  assertMigrationExecuteWriteGuards,
  assertMigrationSourceDatabase,
  assertNoWritePathRequested,
  assertProductionCollisionDatabase,
  assertStagingSourceDatabase,
  isExecuteModeRequested,
  resolveDualMongoEnv,
  resolveMigrationMode,
  resolveSourceMongoEnvForMediaR2Preflight,
} from "./guards.js";

export {
  assertNoSecretLeak,
  fingerprintSha256,
  fingerprintStripeId,
  maskEmail,
} from "./redact.js";

export {
  assertAmbiguousMustFails,
  resolveDocumentAncestry,
} from "./ancestry.js";

export {
  CIVIC_COLLECTION_CATALOG,
  PROJECTION_PLAN_STATIC,
  getCollectionCatalogEntry,
  listCollectionsByClassification,
} from "./collection-plan.js";

export {
  buildParticipantsReport,
  classifyActorId,
  collectActorOccurrencesFromDocument,
  participantVerdictFromReport,
} from "./participant-scan.js";

export {
  assertMembershipPlanSafeForLogging,
  buildStaticMembershipCollectionPlan,
  buildStripeSanitizationPlan,
  planMembershipForParticipant,
  validateNonVladNotStartedOmitted,
  validateVladActiveMemberExpectations,
} from "./membership-plan.js";

export {
  CANONICAL_PUBLIC_MEDIA_PURPOSES,
  classifyCanonicalMediaUploadVisibility,
  classifyMediaHost,
  decideMediaDestinationAction,
  hostnameOf,
  planMediaFromInitiativeDocument,
  planMediaFromSharedDocument,
  planMediaFromUploadRecord,
  summarizeMediaPlan,
} from "./media-plan.js";

export {
  assertAllowListRejectsBootstrapAndTest2,
  assertExactNineAllowList,
  buildCandidateInitiativeRow,
  evaluateInitiativeVerdict,
} from "./source-inventory.js";

export {
  evaluatePartialChildCollision,
  evaluateRootCollisionVerdict,
  runProductionCollisionPreflight,
} from "./collision-preflight.js";

export {
  overallVerdictFromParts,
  runStagingInitiativeMigrationPreflight,
  task071HasWritePath,
} from "./preflight.js";

export {
  DeferredMediaCopyExecutor,
  GatedMediaCopyExecutor,
  assertMediaCopyAuthorized,
  deduplicateMediaPlanItems,
  executeMediaCopyPhase,
  resolveMediaCopyAuthorization,
  rollbackOwnedMediaObjects,
} from "./media-copy.js";

export {
  buildThirtyOneToThirteenMediaFixture,
  reconcileMediaPlanReferences,
  resolveCollapsedMediaVisibility,
} from "./media-reconcile.js";

export {
  formatMediaR2PreflightReport,
  loadReconciledPublicMediaPlanFromSource,
  runMediaR2Preflight,
} from "./media-r2-preflight.js";
export type {
  MediaR2PreflightReport,
  MediaR2PreflightReader,
} from "./media-r2-preflight.js";

export {
  inventoryMustMigrateCivicChildren,
  runPostExecuteProductionInitiativeVerification,
} from "./post-execute-verify.js";
export type {
  PostExecuteVerifyReport,
  PostExecuteVerifyVerdict,
} from "./post-execute-verify.js";

export {
  DualBucketR2MediaCopyExecutor,
  InMemoryMediaCopyExecutor,
  isObjectIntegrityEquivalent,
  normalizeEtag,
  resolveDualR2MediaCopyConfig,
  R2_MIGRATION_OWNERSHIP_MARKER,
  R2_MIGRATION_OWNERSHIP_METADATA_KEYS,
  buildMigrationOwnershipMetadata,
  isProvenOwnedByMigration,
  parseMigrationOwnershipMetadata,
} from "./r2-media-copy.js";

export {
  CRASH_SAFE_EXECUTION_ORDER,
  InMemoryMediaRecoveryJournal,
  JsonlMediaRecoveryJournal,
  MEDIA_RECOVERY_JOURNAL_PATH_ENV,
  sha256Hex,
} from "./media-recovery-journal.js";

export {
  MEDIA_RECOVERY_COLLECTION,
  InMemoryDurableMediaRecoveryStore,
  MongoDurableMediaRecoveryStore,
  inspectMediaRecoveryState,
  rollbackMigrationOwnedMedia,
} from "./media-recovery-store.js";

export type {
  DestinationObjectInspection,
  MigrationObjectOwnershipProof,
} from "./media-ownership.js";

export { MigrationOwnershipLedger } from "./ownership-ledger.js";

export {
  sanitizeBadgeApplicationForMigration,
  sanitizeInitiativeDocumentForMigration,
  sanitizeStripeOperationalFields,
  stripPrivateFieldsForReport,
  rewritePublicMediaUrl,
} from "./sanitize-documents.js";

export {
  assertMigrationWritableCollectionForTest,
  buildSafeMigrationExecutionLog,
  rollbackOwnedMongoInserts,
  runProductionInitiativeMigration,
} from "./execute.js";
export type {
  DualMongoHandles,
  MigrationExecutionReport,
  RunProductionInitiativeMigrationInput,
} from "./execute.js";

export {
  assertInlineExecutionPreflightPass,
  runInlineExecutionPreflight,
} from "./inline-preflight.js";
export type { InlineExecutionPreflightResult } from "./inline-preflight.js";

export type {
  CandidateInitiativeRow,
  CollectionPlanRow,
  MediaPlanItem,
  MigrationClassification,
  ProductionCollisionPreflightReport,
  StagingPreflightReport,
} from "./types.js";
