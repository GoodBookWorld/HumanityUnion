/**
 * Production Blog migration — Task 02 read-only preflight constants.
 * Independent of production-initiative-migration.
 */

export const PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE =
  "humanity_union_staging" as const;
export const PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE =
  "humanity_union_production" as const;

/** Explicit dual-connection env vars — never reuse a single service DB as both sides. */
export const BLOG_SOURCE_MONGODB_URI_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_URI" as const;
export const BLOG_SOURCE_MONGODB_DATABASE_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE" as const;
export const BLOG_DESTINATION_MONGODB_URI_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_URI" as const;
export const BLOG_DESTINATION_MONGODB_DATABASE_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_DATABASE" as const;

/** Optional — when unset, R2 object verification is DEFERRED (Mongo preflight still runs). */
export const BLOG_SOURCE_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCOUNT_ID" as const;
export const BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_ACCESS_KEY_ID" as const;
export const BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_SECRET_ACCESS_KEY" as const;
export const BLOG_SOURCE_R2_BUCKET_ENV =
  "PRODUCTION_BLOG_MIGRATION_SOURCE_R2_BUCKET" as const;
export const BLOG_DESTINATION_R2_ACCOUNT_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCOUNT_ID" as const;
export const BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_ACCESS_KEY_ID" as const;
export const BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_SECRET_ACCESS_KEY" as const;
export const BLOG_DESTINATION_R2_BUCKET_ENV =
  "PRODUCTION_BLOG_MIGRATION_DESTINATION_R2_BUCKET" as const;

export const PRODUCTION_MEDIA_PUBLIC_BASE_URL = "https://media.huws.org" as const;

/** Exact expected staging inventory for controlled Blog migration. */
export const EXPECTED_BLOG_COLLECTION_COUNTS = {
  blog_posts: 14,
  blog_categories: 4,
  blog_subscribers: 17,
  blog_subscription_settings: 0,
  blog_publication_deliveries: 18,
  blog_admin_subscriber_messages: 0,
  blog_admin_subscriber_message_deliveries: 0,
  blog_capability_grants: 3,
  blog_author_applications: 3,
  blog_comments: 0,
  blog_reactions: 3,
} as const;

export const EXPECTED_SEED_CATEGORY_IDS = [
  "conscious_existence",
  "human_security",
  "our_life",
] as const;

export const EXPECTED_INSERT_CATEGORY_ID = "human_potential" as const;

export const EXPECTED_CATEGORY_IDS = [
  ...EXPECTED_SEED_CATEGORY_IDS,
  EXPECTED_INSERT_CATEGORY_ID,
] as const;

export const BLOG_SUBSCRIPTION_TYPE = "blog_publications" as const;

const TEST_DATABASE_NAME_PATTERN = /^hu_test_[a-zA-Z0-9_]+$/;

export function isTestIsolationDatabase(database: string): boolean {
  return TEST_DATABASE_NAME_PATTERN.test(database.trim());
}
