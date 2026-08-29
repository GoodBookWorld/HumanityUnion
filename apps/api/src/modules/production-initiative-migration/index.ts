export {
  APPROVED_PRODUCTION_PARTICIPANTS,
  CANONICAL_INITIATIVE_EXPECTATIONS,
  CANONICAL_PRODUCTION_INITIATIVE_IDS,
  EXCLUDED_PRODUCTION_INITIATIVE_IDS,
  FORBIDDEN_TYPO_AI_COMMON_GOOD_ID,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  SYSTEM_MEDIA_RECOVERY_OWNER,
  isCanonicalInitiativeId,
  isExcludedInitiativeId,
  isForbiddenTypoAiCommonGoodId,
} from "./constants.js";

export { ProductionInitiativeMigrationError } from "./errors.js";

export {
  assertNoWritePathRequested,
  assertProductionCollisionDatabase,
  assertStagingSourceDatabase,
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
  classifyMediaHost,
  decideMediaDestinationAction,
  hostnameOf,
  planMediaFromInitiativeDocument,
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

export type {
  CandidateInitiativeRow,
  CollectionPlanRow,
  MediaPlanItem,
  MigrationClassification,
  ProductionCollisionPreflightReport,
  StagingPreflightReport,
} from "./types.js";
