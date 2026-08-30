export {
  BLOG_DESTINATION_MONGODB_DATABASE_ENV,
  BLOG_DESTINATION_MONGODB_URI_ENV,
  BLOG_SOURCE_MONGODB_DATABASE_ENV,
  BLOG_SOURCE_MONGODB_URI_ENV,
  BLOG_SUBSCRIPTION_TYPE,
  EXPECTED_BLOG_COLLECTION_COUNTS,
  EXPECTED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
  EXPECTED_SEED_CATEGORY_IDS,
  PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  isTestIsolationDatabase,
} from "./constants.js";

export { ProductionBlogMigrationError } from "./errors.js";

export {
  assertBlogMigrationDestinationDatabase,
  assertBlogMigrationSourceDatabase,
  assertNoWritePathRequested,
  isBlogMigrationR2Configured,
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
